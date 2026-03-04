import React, { useCallback, useRef } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Dimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../constants/colors';
import SwipeCard from './SwipeCard';
import type { Job, SwipeDirection } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VISIBLE_CARDS = 3;

export interface SwipeStackProps {
  jobs: Job[];
  onSwipeRight: (job: Job) => void;
  onSwipeLeft: (job: Job) => void;
  onSwipeUp: (job: Job) => void;
  onCardPress: (job: Job) => void;
  onNeedMoreJobs?: () => void;
  isLoading?: boolean;
}

export default function SwipeStack({
  jobs,
  onSwipeRight,
  onSwipeLeft,
  onSwipeUp,
  onCardPress,
  onNeedMoreJobs,
  isLoading,
}: SwipeStackProps) {
  const notifiedRef = useRef(false);

  const handleSwipe = useCallback(
    (job: Job, direction: SwipeDirection) => {
      if (direction === 'right') {
        onSwipeRight(job);
      } else if (direction === 'left') {
        onSwipeLeft(job);
      } else {
        // Open job application link on swipe-up (Apply)
        WebBrowser.openBrowserAsync(job.applyUrl).catch(() => {});
        onSwipeUp(job);
      }

      // Request more jobs when running low
      if (jobs.length <= 3 && !notifiedRef.current) {
        notifiedRef.current = true;
        onNeedMoreJobs?.();
        setTimeout(() => { notifiedRef.current = false; }, 5000);
      }
    },
    [jobs.length, onSwipeRight, onSwipeLeft, onSwipeUp, onNeedMoreJobs]
  );

  if (isLoading && jobs.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.emptyText}>Finding jobs for you...</Text>
      </View>
    );
  }

  if (jobs.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🎉</Text>
        <Text style={styles.emptyTitle}>All caught up!</Text>
        <Text style={styles.emptyText}>
          You've reviewed all available jobs.{'\n'}Pull to refresh for new listings.
        </Text>
      </View>
    );
  }

  // Show top VISIBLE_CARDS cards, rendered in reverse order (top card last = on top)
  const visibleJobs = jobs.slice(0, VISIBLE_CARDS);

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.stackContainer}>
        {visibleJobs
          .slice()
          .reverse()
          .map((job, reversedIdx) => {
            const stackIndex = visibleJobs.length - 1 - reversedIdx;
            const isTop = stackIndex === 0;

            return (
              <SwipeCard
                key={job.id}
                job={job}
                isTop={isTop}
                stackIndex={stackIndex}
                onSwipe={(direction) => handleSwipe(job, direction)}
                onPress={() => onCardPress(job)}
              />
            );
          })}
      </View>

      {/* Swipe Hint (shown only when there are jobs) */}
      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>← Skip  ·  Apply ↑  ·  Save →</Text>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  stackContainer: {
    flex: 1,
    width: SCREEN_WIDTH - 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  hintContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  hintText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 64,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
