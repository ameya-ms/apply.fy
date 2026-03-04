import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { useAppStore } from '../../store/appStore';
import { clearProfile } from '../../lib/userProfile';

export default function ProfileScreen() {
  const { userProfile, resumeData, savedJobs, appliedJobs, resetAll, setOnboarded, searchPreferences } =
    useAppStore();

  const handleResetApp = () => {
    Alert.alert(
      'Reset App',
      'This will clear all your data including profile, resume, saved jobs, and applications. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            await clearProfile();
            resetAll();
            router.replace('/onboarding');
          },
        },
      ]
    );
  };

  const handleEditProfile = () => {
    router.push('/onboarding/profile');
  };

  const handleEditPreferences = () => {
    router.push('/onboarding/preferences');
  };

  const handleUpdateResume = () => {
    router.push('/onboarding/resume');
  };

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.noProfile}>
          <Text style={styles.noProfileEmoji}>👤</Text>
          <Text style={styles.noProfileTitle}>No Profile Set</Text>
          <Text style={styles.noProfileText}>
            Import your .env file to set up your profile.
          </Text>
          <TouchableOpacity style={styles.setupBtn} onPress={handleEditProfile}>
            <LinearGradient colors={Colors.gradients.primary} style={styles.setupBtnGradient}>
              <Text style={styles.setupBtnText}>Set Up Profile</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <LinearGradient
          colors={['#EDF7F0', '#D5EFDC']}
          style={styles.profileHeader}
        >
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {userProfile.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </Text>
          </View>
          <Text style={styles.profileName}>{userProfile.name}</Text>
          <Text style={styles.profileEmail}>{userProfile.email}</Text>
          {userProfile.phone && (
            <Text style={styles.profilePhone}>{userProfile.phone}</Text>
          )}
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox label="Applied" value={appliedJobs.length} color={Colors.primary} />
          <StatBox label="Saved" value={savedJobs.length} color={Colors.warning} />
          <StatBox
            label="Interviews"
            value={appliedJobs.filter((j) => j.status === 'interviewing').length}
            color={Colors.success}
          />
          <StatBox
            label="Offers"
            value={appliedJobs.filter((j) => j.status === 'offer').length}
            color={Colors.successLight}
          />
        </View>

        {/* Profile Info */}
        <Section title="Profile">
          <InfoRow label="Name" value={userProfile.name} />
          <InfoRow label="Email" value={userProfile.email} />
          {userProfile.phone && <InfoRow label="Phone" value={userProfile.phone} />}
          {userProfile.linkedinUrl && (
            <InfoRow label="LinkedIn" value={userProfile.linkedinUrl} truncate />
          )}
          {userProfile.portfolioUrl && (
            <InfoRow label="Portfolio" value={userProfile.portfolioUrl} truncate />
          )}
          {userProfile.githubUrl && (
            <InfoRow label="GitHub" value={userProfile.githubUrl} truncate />
          )}
          <InfoRow label="Experience" value={`${userProfile.yearsExperience} years`} />

          <TouchableOpacity style={styles.editBtn} onPress={handleEditProfile}>
            <Text style={styles.editBtnText}>✎ Edit Profile (re-import .env)</Text>
          </TouchableOpacity>
        </Section>

        {/* Skills */}
        {userProfile.skills.length > 0 && (
          <Section title="Skills">
            <View style={styles.skillsGrid}>
              {userProfile.skills.map((skill) => (
                <View key={skill} style={styles.skillChip}>
                  <Text style={styles.skillText}>{skill}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* Resume */}
        <Section title="Resume">
          {resumeData ? (
            <>
              <InfoRow label="Experience" value={`${resumeData.experience.length} roles`} />
              <InfoRow label="Projects" value={`${resumeData.projects.length} projects`} />
              <InfoRow label="Education" value={`${resumeData.education.length} entries`} />
              <InfoRow
                label="Skills detected"
                value={`${resumeData.skills.length} skills`}
              />
              {resumeData.experience[0] && (
                <InfoRow
                  label="Latest Role"
                  value={`${resumeData.experience[0].title} at ${resumeData.experience[0].company}`}
                />
              )}
            </>
          ) : (
            <Text style={styles.noData}>No resume uploaded</Text>
          )}
          <TouchableOpacity style={styles.editBtn} onPress={handleUpdateResume}>
            <Text style={styles.editBtnText}>
              {resumeData ? '↑ Update Resume' : '+ Upload Resume'}
            </Text>
          </TouchableOpacity>
        </Section>

        {/* Job Preferences */}
        <Section title="Job Preferences">
          <InfoRow
            label="Roles"
            value={
              searchPreferences.roles.length > 0
                ? searchPreferences.roles.join(', ')
                : 'Not set'
            }
          />
          <InfoRow
            label="Locations"
            value={
              searchPreferences.locations.length > 0
                ? searchPreferences.locations.join(', ')
                : 'Not set'
            }
          />
          <InfoRow label="Remote" value={searchPreferences.remotePreference} />
          {userProfile.salaryMin && (
            <InfoRow
              label="Salary"
              value={`$${Math.round(userProfile.salaryMin / 1000)}k${userProfile.salaryMax ? ` – $${Math.round(userProfile.salaryMax / 1000)}k` : '+'}`}
            />
          )}
          <TouchableOpacity style={styles.editBtn} onPress={handleEditPreferences}>
            <Text style={styles.editBtnText}>✎ Edit Preferences</Text>
          </TouchableOpacity>
        </Section>

        {/* API Keys */}
        <Section title="API Keys">
          <APIKeyRow
            label="Anthropic (AI Features)"
            configured={!!(userProfile.anthropicApiKey)}
            configuredText="✓ Connected"
            unconfiguredText="Not configured"
          />
          <APIKeyRow
            label="JSearch (Job Discovery)"
            configured={!!(userProfile.jsearchApiKey)}
            configuredText="✓ Connected"
            unconfiguredText="Using free APIs"
          />
          <Text style={styles.apiNote}>
            Update API keys by re-importing your .env file.
          </Text>
        </Section>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleResetApp}>
            <Text style={styles.dangerBtnText}>Reset App & Clear All Data</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>apply.fy v1.0.0 · Your data stays on your device</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={truncate ? 1 : undefined}>
        {value}
      </Text>
    </View>
  );
}

function APIKeyRow({
  label,
  configured,
  configuredText,
  unconfiguredText,
}: {
  label: string;
  configured: boolean;
  configuredText: string;
  unconfiguredText: string;
}) {
  return (
    <View style={styles.apiRow}>
      <Text style={styles.apiLabel}>{label}</Text>
      <Text
        style={[
          styles.apiStatus,
          { color: configured ? Colors.success : Colors.textMuted },
        ]}
      >
        {configured ? configuredText : unconfiguredText}
      </Text>
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 6,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryAlpha,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: Colors.primary },
  profileName: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  profileEmail: { fontSize: 14, color: Colors.textSecondary },
  profilePhone: { fontSize: 13, color: Colors.textMuted },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sectionContent: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: { fontSize: 14, color: Colors.textMuted, fontWeight: '600', width: 100 },
  infoValue: { fontSize: 14, color: Colors.textSecondary, flex: 1, textAlign: 'right' },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editBtnText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 14,
  },
  skillChip: {
    backgroundColor: Colors.primaryAlpha,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  skillText: { fontSize: 12, color: Colors.primaryLight, fontWeight: '600' },
  noData: {
    fontSize: 14,
    color: Colors.textMuted,
    padding: 16,
    textAlign: 'center',
  },
  apiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  apiLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500', flex: 1 },
  apiStatus: { fontSize: 13, fontWeight: '600' },
  apiNote: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    padding: 12,
  },
  dangerZone: {
    margin: 16,
    marginTop: 24,
    padding: 16,
    backgroundColor: Colors.dangerAlpha,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.danger,
    gap: 12,
  },
  dangerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dangerBtn: {
    backgroundColor: Colors.danger,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 20,
    marginBottom: 8,
  },
  noProfile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 14,
  },
  noProfileEmoji: { fontSize: 64 },
  noProfileTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  noProfileText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  setupBtn: { borderRadius: 14, overflow: 'hidden', width: '100%' },
  setupBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  setupBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
});
