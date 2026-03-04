import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../../constants/colors';
import { useAppStore } from '../../store/appStore';
import JobDetailModal from '../../components/JobDetailModal';
import type { Job } from '../../types';

export default function SavedScreen() {
  const { savedJobs, unsaveJob, swipeRight, userProfile, resumeData } = useAppStore();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleApply = (job: Job) => {
    WebBrowser.openBrowserAsync(job.applyUrl).catch(() => {});
    swipeRight(job);
    unsaveJob(job.id);
  };

  const handleUnsave = (jobId: string) => {
    Alert.alert('Remove Job', 'Remove this job from saved?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => unsaveJob(jobId) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved Jobs</Text>
        <Text style={styles.headerCount}>{savedJobs.length}</Text>
      </View>

      {savedJobs.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={savedJobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <JobListCard
              job={item}
              onPress={() => {
                setSelectedJob(item);
                setIsModalVisible(true);
              }}
              onApply={() => handleApply(item)}
              onRemove={() => handleUnsave(item.id)}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      <JobDetailModal
        job={selectedJob}
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onApply={swipeRight}
        onSave={() => {}}
        resume={resumeData}
        profile={userProfile}
        hasAI={!!(userProfile?.openaiApiKey)}
      />
    </SafeAreaView>
  );
}

function JobListCard({
  job,
  onPress,
  onApply,
  onRemove,
}: {
  job: Job;
  onPress: () => void;
  onApply: () => void;
  onRemove: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardLeft}>
        {job.companyLogo ? (
          <Image source={{ uri: job.companyLogo }} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.logoFallback}>
            <Text style={styles.logoText}>{job.company[0]?.toUpperCase()}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
        <Text style={styles.company}>{job.company}</Text>
        <Text style={styles.location}>📍 {job.location}</Text>
        {job.salary && <Text style={styles.salary}>💰 {job.salary}</Text>}

        {job.matchScore !== undefined && (
          <View style={[styles.matchPill, { backgroundColor: matchBg(job.matchScore) }]}>
            <Text style={[styles.matchPillText, { color: matchColor(job.matchScore) }]}>
              {job.matchScore}% match
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.applyBtn} onPress={onApply}>
          <Text style={styles.applyBtnText}>Apply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
          <Text style={styles.removeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>★</Text>
      <Text style={styles.emptyTitle}>No saved jobs yet</Text>
      <Text style={styles.emptyText}>
        Swipe up on jobs you want to review later. They'll appear here.
      </Text>
    </View>
  );
}

function matchColor(score: number) {
  if (score >= 80) return Colors.success;
  if (score >= 60) return Colors.warning;
  return Colors.danger;
}

function matchBg(score: number) {
  if (score >= 80) return Colors.successAlpha;
  if (score >= 60) return Colors.warningAlpha;
  return Colors.dangerAlpha;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  headerCount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.warning,
    backgroundColor: Colors.warningAlpha,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
  },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardLeft: { paddingTop: 2 },
  logo: { width: 44, height: 44, borderRadius: 10 },
  logoFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.primaryAlpha,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  logoText: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  cardContent: { flex: 1, gap: 3 },
  jobTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  company: { fontSize: 13, color: Colors.primaryLight, fontWeight: '500' },
  location: { fontSize: 12, color: Colors.textSecondary },
  salary: { fontSize: 12, color: Colors.success, fontWeight: '600' },
  matchPill: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  matchPillText: { fontSize: 11, fontWeight: '700' },
  cardActions: { gap: 8, alignItems: 'center' },
  applyBtn: {
    backgroundColor: Colors.success,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  applyBtnText: { fontSize: 12, fontWeight: '700', color: Colors.textInverse },
  removeBtn: {
    backgroundColor: Colors.dangerAlpha,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  removeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.danger },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyEmoji: { fontSize: 64, color: Colors.warning },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
