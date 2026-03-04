import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';
import type { Job, SwipeDirection } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.62;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.38;
const VERTICAL_THRESHOLD = SCREEN_HEIGHT * 0.22;
const VELOCITY_THRESHOLD = 700;

export interface SwipeCardProps {
  job: Job;
  onSwipe: (direction: SwipeDirection) => void;
  onPress: () => void;
  isTop: boolean;
  stackIndex: number; // 0 = top, 1 = second, 2 = third
}

export default function SwipeCard({ job, onSwipe, onPress, isTop, stackIndex }: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const triggerHaptic = useCallback((direction: SwipeDirection) => {
    const style =
      direction === 'right'
        ? Haptics.ImpactFeedbackStyle.Medium
        : direction === 'up'
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Rigid;
    Haptics.impactAsync(style).catch(() => {});
  }, []);

  const handleSwipe = useCallback(
    (direction: SwipeDirection) => {
      triggerHaptic(direction);
      onSwipe(direction);
    },
    [onSwipe, triggerHaptic]
  );

  const gesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;
    })
    .onEnd((e) => {
      // Determine dominant axis to prevent diagonal mis-detection
      const absX = Math.abs(e.translationX);
      const absY = Math.abs(e.translationY);
      const isMovingUp = e.translationY < 0;
      const isDominantlyVertical = isMovingUp && absY > absX * 0.5;

      const isSwipeUp =
        isDominantlyVertical &&
        (e.translationY < -VERTICAL_THRESHOLD || e.velocityY < -VELOCITY_THRESHOLD);
      const isSwipeRight =
        !isDominantlyVertical &&
        (e.translationX > SWIPE_THRESHOLD || e.velocityX > VELOCITY_THRESHOLD);
      const isSwipeLeft =
        !isDominantlyVertical &&
        (e.translationX < -SWIPE_THRESHOLD || e.velocityX < -VELOCITY_THRESHOLD);

      if (isSwipeUp) {
        translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 350 });
        runOnJS(handleSwipe)('up');
      } else if (isSwipeRight) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 350 });
        translateY.value = withTiming(e.translationY * 0.5, { duration: 350 });
        runOnJS(handleSwipe)('right');
      } else if (isSwipeLeft) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 350 });
        translateY.value = withTiming(e.translationY * 0.5, { duration: 350 });
        runOnJS(handleSwipe)('left');
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  // ─── Animated Styles ─────────────────────────────────────────────────────

  const cardStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-18, 0, 18],
      Extrapolation.CLAMP
    );

    if (!isTop) {
      const drag = Math.abs(translateX.value) / SCREEN_WIDTH;
      const scaleBase = 1 - stackIndex * 0.04;
      const scaleDelta = stackIndex * 0.04 * drag;
      const scale = Math.min(1, scaleBase + scaleDelta);

      const translateYBase = stackIndex * 12;
      const translateYDelta = -stackIndex * 12 * drag;

      // More distinct opacity per stack position: 0.85 → 0.65 → 0.45
      const opacityBase = interpolate(stackIndex, [1, 3], [0.85, 0.45], Extrapolation.CLAMP);
      const opacityDelta = (1 - opacityBase) * drag * 0.5;

      return {
        transform: [
          { scale },
          { translateY: translateYBase + translateYDelta },
        ],
        opacity: Math.min(1, opacityBase + opacityDelta),
      };
    }

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  // ─── Overlay Styles ───────────────────────────────────────────────────────

  const applyOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD * 0.6],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const skipOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD * 0.6, 0],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  const saveOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [-VERTICAL_THRESHOLD * 0.6, 0],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  // ─── Render ───────────────────────────────────────────────────────────────

  const card = (
    <Animated.View style={[styles.card, cardStyle]}>
      {/* Company Logo / Gradient Header */}
      <LinearGradient
        colors={['#EDF7F0', '#F5FAF6', '#EDF7F0']}
        style={styles.cardHeader}
      >
        {job.companyLogo ? (
          <Image
            source={{ uri: job.companyLogo }}
            style={styles.companyLogo}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.companyLogoFallback}>
            <Text style={styles.companyLogoText}>{job.company[0]?.toUpperCase()}</Text>
          </View>
        )}

        {/* Match Score Badge */}
        {job.matchScore !== undefined && (
          <View style={[styles.matchBadge, { backgroundColor: matchColor(job.matchScore) }]}>
            <Text style={styles.matchText}>{job.matchScore}%</Text>
          </View>
        )}

        {/* Remote Badge */}
        {job.remote === 'remote' && (
          <View style={styles.remoteBadge}>
            <Text style={styles.remoteText}>🌐 Remote</Text>
          </View>
        )}
      </LinearGradient>

      {/* Job Info */}
      <View style={styles.cardBody}>
        <Text style={styles.jobTitle} numberOfLines={2}>{job.title}</Text>
        <Text style={styles.companyName}>{job.company}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>📍 {job.location}</Text>
          {job.salary && <Text style={styles.salaryText}>💰 {job.salary}</Text>}
        </View>

        {job.jobType && (
          <View style={styles.tagRow}>
            <TagChip label={job.jobType} />
            {job.tags?.slice(0, 2).map((tag) => <TagChip key={tag} label={tag} />)}
          </View>
        )}

        <Text style={styles.description} numberOfLines={4}>
          {job.description}
        </Text>

        <TouchableOpacity style={styles.detailsBtn} onPress={onPress} activeOpacity={0.7}>
          <Text style={styles.detailsBtnText}>View Details →</Text>
        </TouchableOpacity>
      </View>

      {/* Swipe Overlays */}
      <Animated.View style={[styles.overlay, styles.saveOverlay, applyOverlayStyle]}>
        <Text style={styles.overlayText}>SAVE</Text>
      </Animated.View>

      <Animated.View style={[styles.overlay, styles.skipOverlay, skipOverlayStyle]}>
        <Text style={styles.overlayText}>SKIP</Text>
      </Animated.View>

      <Animated.View style={[styles.overlay, styles.applyOverlay, saveOverlayStyle]}>
        <Text style={styles.overlayText}>APPLY</Text>
      </Animated.View>
    </Animated.View>
  );

  if (!isTop) return card;

  return (
    <GestureDetector gesture={gesture}>
      {card}
    </GestureDetector>
  );
}

function TagChip({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

function matchColor(score: number): string {
  if (score >= 80) return Colors.success;
  if (score >= 60) return Colors.warning;
  return Colors.danger;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  cardHeader: {
    height: CARD_HEIGHT * 0.3,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  companyLogo: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  companyLogoFallback: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: Colors.primaryAlpha,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  companyLogoText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
  },
  matchBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchText: {
    color: Colors.textInverse,
    fontSize: 12,
    fontWeight: '700',
  },
  remoteBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: Colors.infoAlpha,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.info,
  },
  remoteText: {
    color: Colors.info,
    fontSize: 11,
    fontWeight: '600',
  },
  cardBody: {
    flex: 1,
    padding: 20,
  },
  jobTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primaryLight,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  salaryText: {
    fontSize: 13,
    color: Colors.success,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: Colors.primaryAlpha,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  tagText: {
    fontSize: 11,
    color: Colors.primaryLight,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  detailsBtn: {
    marginTop: 8,
    paddingVertical: 4,
  },
  detailsBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  // ─── Swipe Overlays ──────────────────────────────────────────────────────
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    pointerEvents: 'none',
  },
  applyOverlay: {
    backgroundColor: Colors.successAlpha,
    borderWidth: 3,
    borderColor: Colors.success,
  },
  skipOverlay: {
    backgroundColor: Colors.dangerAlpha,
    borderWidth: 3,
    borderColor: Colors.danger,
  },
  saveOverlay: {
    backgroundColor: Colors.warningAlpha,
    borderWidth: 3,
    borderColor: Colors.warning,
  },
  overlayText: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.textInverse,
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});

export { CARD_WIDTH, CARD_HEIGHT };
