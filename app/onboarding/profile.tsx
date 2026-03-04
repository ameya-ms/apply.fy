import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { useAppStore } from '../../store/appStore';
import { parseEnvFile, validateProfile, saveProfile } from '../../lib/userProfile';
import { initAI } from '../../lib/aiAssistant';
import type { UserProfile } from '../../types';

export default function ProfileOnboarding() {
  const { setUserProfile } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [loadedProfile, setLoadedProfile] = useState<UserProfile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleImportEnv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file) return;

      setLoading(true);

      // Read file content
      const response = await fetch(file.uri);
      const content = await response.text();

      const profile = parseEnvFile(content);
      const validation = validateProfile(profile);

      setLoadedProfile(profile);
      setErrors(validation.errors);
      setWarnings(validation.warnings);
    } catch (e) {
      Alert.alert('Import Error', 'Could not read the file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!loadedProfile) return;

    const validation = validateProfile(loadedProfile);
    if (!validation.valid) {
      Alert.alert('Missing Required Fields', validation.errors.join('\n'));
      return;
    }

    setLoading(true);
    try {
      await saveProfile(loadedProfile);
      setUserProfile(loadedProfile);

      // Initialize AI if key present
      if (loadedProfile.openaiApiKey) {
        initAI(loadedProfile.openaiApiKey);
      }

      router.push('/onboarding/resume');
    } catch (e) {
      Alert.alert('Error', 'Could not save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/onboarding/resume');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.progress}>
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
        </View>
      </View>

      <Text style={styles.title}>Import Your Profile</Text>
      <Text style={styles.subtitle}>
        Create a <Text style={styles.code}>.env</Text> file from the template and import it.
        Your data stays on your device.
      </Text>

      {/* ENV File Format Preview */}
      <View style={styles.codeBlock}>
        <Text style={styles.codeTitle}>.env format</Text>
        <Text style={styles.codeText}>
          {'NAME=Your Full Name\nEMAIL=you@example.com\nPHONE=+1 555 000 0000\nLINKEDIN_URL=https://linkedin.com/in/...\nSKILLS=React,TypeScript,Node.js\nYEARS_EXPERIENCE=4\nPREFERRED_ROLES=Software Engineer\nPREFERRED_LOCATIONS=San Francisco CA,Remote\nOPENAI_API_KEY=sk-...\nJSEARCH_API_KEY=your_key'}
        </Text>
      </View>

      {/* Import Button */}
      <TouchableOpacity
        style={[styles.importBtn, loading && { opacity: 0.6 }]}
        onPress={handleImportEnv}
        disabled={loading}
        activeOpacity={0.8}
      >
        <LinearGradient colors={Colors.gradients.primary} style={styles.importBtnGradient}>
          {loading ? (
            <ActivityIndicator color={Colors.textPrimary} />
          ) : (
            <>
              <Text style={styles.importBtnIcon}>📂</Text>
              <Text style={styles.importBtnText}>
                {loadedProfile ? 'Re-import .env File' : 'Import .env File'}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Preview */}
      {loadedProfile && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>✓ Profile Loaded</Text>

          <ProfileRow label="Name" value={loadedProfile.name || '—'} />
          <ProfileRow label="Email" value={loadedProfile.email || '—'} />
          <ProfileRow label="Phone" value={loadedProfile.phone || '—'} />
          <ProfileRow label="LinkedIn" value={loadedProfile.linkedinUrl || '—'} />
          <ProfileRow
            label="Skills"
            value={
              loadedProfile.skills.length > 0
                ? `${loadedProfile.skills.slice(0, 4).join(', ')}${loadedProfile.skills.length > 4 ? ` +${loadedProfile.skills.length - 4}` : ''}`
                : '—'
            }
          />
          <ProfileRow label="Experience" value={`${loadedProfile.yearsExperience} years`} />
          <ProfileRow
            label="AI"
            value={loadedProfile.openaiApiKey ? '✓ OpenAI key detected' : '✗ No API key'}
            valueColor={loadedProfile.openaiApiKey ? Colors.success : Colors.warning}
          />
          <ProfileRow
            label="Jobs API"
            value={loadedProfile.jsearchApiKey ? '✓ JSearch key detected' : '✗ No key (using free APIs)'}
            valueColor={loadedProfile.jsearchApiKey ? Colors.success : Colors.textMuted}
          />

          {errors.length > 0 && (
            <View style={styles.errorBox}>
              {errors.map((e, i) => (
                <Text key={i} style={styles.errorText}>⚠ {e}</Text>
              ))}
            </View>
          )}

          {warnings.length > 0 && (
            <View style={styles.warningBox}>
              {warnings.map((w, i) => (
                <Text key={i} style={styles.warningText}>ℹ {w}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {loadedProfile && errors.length === 0 && (
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={handleContinue}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient colors={Colors.gradients.success} style={styles.continueBtnGradient}>
              <Text style={styles.continueBtnText}>Continue →</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function ProfileRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={[styles.profileValue, valueColor ? { color: valueColor } : {}]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  backBtn: {
    padding: 4,
  },
  backBtnText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  progress: {
    flexDirection: 'row',
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  code: {
    fontFamily: 'Courier',
    backgroundColor: Colors.surface,
    color: Colors.primaryLight,
  },
  codeBlock: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  codeText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: Colors.primaryLight,
    lineHeight: 19,
  },
  importBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },
  importBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  importBtnIcon: {
    fontSize: 20,
  },
  importBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  preview: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.success,
    marginBottom: 4,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
    width: 90,
  },
  profileValue: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    textAlign: 'right',
  },
  errorBox: {
    backgroundColor: Colors.dangerAlpha,
    borderRadius: 8,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
  },
  warningBox: {
    backgroundColor: Colors.warningAlpha,
    borderRadius: 8,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  warningText: {
    color: Colors.warning,
    fontSize: 13,
  },
  actions: {
    gap: 12,
  },
  continueBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  continueBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  skipBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 15,
    color: Colors.textMuted,
    fontWeight: '600',
  },
});
