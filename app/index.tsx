import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from '../store/appStore';
import { Colors } from '../constants/colors';
import { initAI } from '../lib/aiAssistant';

export default function Index() {
  const isOnboarded = useAppStore((s) => s.isOnboarded);
  const userProfile = useAppStore((s) => s.userProfile);

  useEffect(() => {
    // Initialize AI if API key is available
    if (userProfile?.openaiApiKey) {
      initAI(userProfile.openaiApiKey);
    }

    const timer = setTimeout(() => {
      if (isOnboarded && userProfile) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isOnboarded, userProfile]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
