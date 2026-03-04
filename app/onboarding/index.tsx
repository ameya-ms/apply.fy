import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';

const { height } = Dimensions.get('window');

const FEATURES = [
  { emoji: '💼', title: 'Swipe Through Jobs', desc: 'Tinder-style job discovery — right to apply, left to skip, up to save' },
  { emoji: '🤖', title: 'AI Application Assistant', desc: 'Auto-generate cover letters and answer application questions with GPT-4' },
  { emoji: '📄', title: 'Smart Resume Parsing', desc: 'Import your LaTeX resume and let AI tailor your applications automatically' },
  { emoji: '🎯', title: 'Job Match Scoring', desc: 'See how well each job matches your skills and experience' },
];

export default function OnboardingWelcome() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.background, '#13131F', Colors.background]}
        style={StyleSheet.absoluteFill}
      />

      {/* Logo */}
      <View style={styles.logoContainer}>
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>⚡</Text>
        </View>
        <Text style={styles.appName}>apply.fy</Text>
        <Text style={styles.tagline}>Job hunting, gamified.</Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {FEATURES.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureEmoji}>{f.emoji}</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/profile')}
          activeOpacity={0.85}
        >
          <LinearGradient colors={Colors.gradients.primary} style={styles.primaryBtnGradient}>
            <Text style={styles.primaryBtnText}>Get Started →</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.privacy}>
          Your data stays on your device. No account required.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 48,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primaryAlpha,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  logoEmoji: {
    fontSize: 36,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  features: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  featureEmoji: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  featureDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  ctaContainer: {
    gap: 14,
  },
  primaryBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryBtnGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  privacy: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
  },
});
