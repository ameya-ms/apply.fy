import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../../constants/colors';
import { useAppStore } from '../../store/appStore';
import { getSwipeStats } from '../../lib/database';
import type { Job } from '../../types';

const STATUS_OPTIONS = ['pending', 'submitted', 'interviewing', 'rejected', 'offer'] as const;
type AppStatus = (typeof STATUS_OPTIONS)[number];

const STATUS_COLORS: Record<AppStatus, string> = {
  pending: Colors.textMuted,
  submitted: Colors.info,
  interviewing: Colors.warning,
  rejected: Colors.danger,
  offer: Colors.success,
};

const STATUS_LABELS: Record<AppStatus, string> = {
  pending: '⏳ Pending',
  submitted: '📤 Submitted',
  interviewing: '🎯 Interviewing',
  rejected: '✕ Rejected',
  offer: '🎉 Offer!',
};

export default function AppliedScreen() {
  const { appliedJobs, updateAppliedJobStatus } = useAppStore();
  const [stats, setStats] = useState({ total: 0, applied: 0, saved: 0, skipped: 0 });

  useEffect(() => {
    getSwipeStats().then(setStats).catch(() => {});
  }, []);

  const groupedJobs = STATUS_OPTIONS.reduce(
    (acc, status) => {
      acc[status] = appliedJobs.filter((j) => j.status === status || (status === 'pending' && j.status === 'applied'));
      return acc;
    },
    {} as Record<AppStatus, Job[]>
  );

  const totalActive = appliedJobs.filter(
    (j) => j.status !== 'rejected' && j.status !== 'applied'
  ).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Applications</Text>
        <Text style={styles.headerCount}>{appliedJobs.length}</Text>
      </View>

      {/* Stats Banner */}
      <View style={styles.statsBanner}>
        <StatCard label="Applied" value={appliedJobs.length} color={Colors.primary} />
        <StatCard label="Interviewing" value={groupedJobs.interviewing.length} color={Colors.warning} />
        <StatCard label="Offers" value={groupedJobs.offer.length} color={Colors.success} />
        <StatCard label="Skipped" value={stats.skipped} color={Colors.textMuted} />
      </View>

      {appliedJobs.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={appliedJobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <AppliedJobCard
              job={item}
              onStatusChange={(status) => updateAppliedJobStatus(item.id, status)}
              onOpenLink={() => WebBrowser.openBrowserAsync(item.applyUrl).catch(() => {})}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function AppliedJobCard({
  job,
  onStatusChange,
  onOpenLink,
}: {
  job: Job;
  onStatusChange: (status: Job['status']) => void;
  onOpenLink: () => void;
}) {
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const currentStatus = (job.status === 'applied' ? 'pending' : job.status) as AppStatus;

  return (
    <View style={styles.card}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        {job.companyLogo ? (
          <Image source={{ uri: job.companyLogo }} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.logoFallback}>
            <Text style={styles.logoText}>{job.company[0]?.toUpperCase()}</Text>
          </View>
        )}

        <View style={styles.cardInfo}>
          <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
          <Text style={styles.company}>{job.company} · {job.location}</Text>
          {job.appliedDate && (
            <Text style={styles.date}>Applied {formatDate(job.appliedDate)}</Text>
          )}
        </View>

        <TouchableOpacity style={styles.linkBtn} onPress={onOpenLink}>
          <Text style={styles.linkBtnText}>↗</Text>
        </TouchableOpacity>
      </View>

      {/* Status Row */}
      <View style={styles.statusRow}>
        <TouchableOpacity
          style={[
            styles.statusBadge,
            { borderColor: STATUS_COLORS[currentStatus] + '60', backgroundColor: STATUS_COLORS[currentStatus] + '20' },
          ]}
          onPress={() => setShowStatusPicker(!showStatusPicker)}
        >
          <Text style={[styles.statusText, { color: STATUS_COLORS[currentStatus] }]}>
            {STATUS_LABELS[currentStatus]}
          </Text>
          <Text style={[styles.statusChevron, { color: STATUS_COLORS[currentStatus] }]}>
            {showStatusPicker ? ' ▲' : ' ▼'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status Picker */}
      {showStatusPicker && (
        <View style={styles.statusPicker}>
          {STATUS_OPTIONS.map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.statusOption, currentStatus === status && styles.statusOptionActive]}
              onPress={() => {
                onStatusChange(status);
                setShowStatusPicker(false);
              }}
            >
              <Text
                style={[
                  styles.statusOptionText,
                  { color: STATUS_COLORS[status] },
                ]}
              >
                {STATUS_LABELS[status]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>✓</Text>
      <Text style={styles.emptyTitle}>No applications yet</Text>
      <Text style={styles.emptyText}>
        Swipe right on jobs to apply. Your applications will be tracked here.
      </Text>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
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
    color: Colors.primary,
    backgroundColor: Colors.primaryAlpha,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statsBanner: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 40, height: 40, borderRadius: 8 },
  logoFallback: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.primaryAlpha,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  logoText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  cardInfo: { flex: 1 },
  jobTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  company: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  date: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  linkBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  statusRow: { flexDirection: 'row' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  statusText: { fontSize: 13, fontWeight: '700' },
  statusChevron: { fontSize: 10 },
  statusPicker: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statusOptionActive: { backgroundColor: Colors.primaryAlpha },
  statusOptionText: { fontSize: 14, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyEmoji: { fontSize: 64, color: Colors.success },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
