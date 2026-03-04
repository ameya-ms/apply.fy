import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '../../store/appStore';
import SwipeStack from '../../components/SwipeStack';
import ActionButtons from '../../components/ActionButtons';
import JobDetailModal from '../../components/JobDetailModal';
import { Colors } from '../../constants/colors';
import { fetchJobs, getMockJobs } from '../../lib/jobService';
import type { Job } from '../../types';

export default function DiscoverScreen() {
  const {
    jobs,
    savedJobs,
    appliedJobs,
    userProfile,
    resumeData,
    searchPreferences,
    isLoadingJobs,
    setJobs,
    appendJobs,
    setLoadingJobs,
    setJobsError,
    swipeRight,
    swipeLeft,
    swipeUp,
  } = useAppStore();

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasFetched = useRef(false);

  const loadJobs = useCallback(
    async (refresh = false) => {
      if (isLoadingJobs && !refresh) return;
      setLoadingJobs(true);
      setJobsError(null);

      try {
        // Use mock jobs if no API keys are configured
        const hasApiKey = !!(userProfile?.jsearchApiKey || userProfile?.museApiKey);

        let newJobs: Job[];
        if (hasApiKey) {
          newJobs = await fetchJobs({
            preferences: searchPreferences,
            jsearchApiKey: userProfile?.jsearchApiKey,
            museApiKey: userProfile?.museApiKey,
            resume: resumeData ?? undefined,
            profile: userProfile ?? undefined,
          });
        } else {
          // Demo mode with mock jobs
          newJobs = getMockJobs();
        }

        if (refresh) {
          setJobs(newJobs);
        } else {
          appendJobs(newJobs);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load jobs';
        setJobsError(msg);
        // Fall back to mock jobs
        if (jobs.length === 0) {
          setJobs(getMockJobs());
        }
      } finally {
        setLoadingJobs(false);
      }
    },
    [
      isLoadingJobs,
      userProfile,
      searchPreferences,
      resumeData,
      jobs.length,
      setJobs,
      appendJobs,
      setLoadingJobs,
      setJobsError,
    ]
  );

  useEffect(() => {
    if (!hasFetched.current && jobs.length === 0) {
      hasFetched.current = true;
      loadJobs();
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadJobs(true);
    setRefreshing(false);
  };

  const handleCardPress = (job: Job) => {
    setSelectedJob(job);
    setIsModalVisible(true);
  };

  // Manual swipe buttons
  const handleSkip = () => {
    if (jobs[0]) swipeLeft(jobs[0]);
  };

  const handleApply = () => {
    if (jobs[0]) swipeRight(jobs[0]);
  };

  const handleSave = () => {
    if (jobs[0]) swipeUp(jobs[0]);
  };

  const hasAI = !!(userProfile?.anthropicApiKey);
  const isDemo = !(userProfile?.jsearchApiKey || userProfile?.museApiKey);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>apply.fy</Text>
          <Text style={styles.headerSubtitle}>
            {jobs.length > 0
              ? `${jobs.length} jobs to review`
              : isLoadingJobs
              ? 'Loading...'
              : 'All caught up!'}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {isDemo && (
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>Demo</Text>
            </View>
          )}
          <View style={styles.statsRow}>
            <StatPill emoji="✓" count={appliedJobs.length} color={Colors.success} />
            <StatPill emoji="★" count={savedJobs.length} color={Colors.warning} />
          </View>
        </View>
      </View>

      {/* Main Swipe Area */}
      <View style={styles.swipeArea}>
        <SwipeStack
          jobs={jobs}
          onSwipeRight={swipeRight}
          onSwipeLeft={swipeLeft}
          onSwipeUp={swipeUp}
          onCardPress={handleCardPress}
          onNeedMoreJobs={() => loadJobs(false)}
          isLoading={isLoadingJobs}
        />
      </View>

      {/* Action Buttons */}
      {jobs.length > 0 && (
        <View style={styles.actionArea}>
          <ActionButtons
            onSkip={handleSkip}
            onApply={handleApply}
            onSave={handleSave}
            disabled={isLoadingJobs && jobs.length === 0}
          />
        </View>
      )}

      {/* Refresh when empty */}
      {jobs.length === 0 && !isLoadingJobs && (
        <View style={styles.refreshContainer}>
          <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
            <LinearGradient colors={Colors.gradients.primary} style={styles.refreshBtnGradient}>
              <Text style={styles.refreshBtnText}>↺ Find More Jobs</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Job Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onApply={swipeRight}
        onSave={swipeUp}
        resume={resumeData}
        profile={userProfile}
        hasAI={hasAI}
      />
    </SafeAreaView>
  );
}

function StatPill({
  emoji,
  count,
  color,
}: {
  emoji: string;
  count: number;
  color: string;
}) {
  return (
    <View style={[styles.statPill, { borderColor: color + '40' }]}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statCount, { color }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  demoBadge: {
    backgroundColor: Colors.warningAlpha,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  demoBadgeText: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statEmoji: { fontSize: 12 },
  statCount: { fontSize: 13, fontWeight: '700' },
  swipeArea: {
    flex: 1,
    paddingTop: 12,
  },
  actionArea: {
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  refreshContainer: {
    padding: 20,
  },
  refreshBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  refreshBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  refreshBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
