import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../utils/theme';

interface LoadingModelProps {
  progress: number;
  error?: string | null;
  onRetry?: () => void;
}

export default function LoadingModel({
  progress,
  error,
  onRetry,
}: LoadingModelProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const downloadedMB = Math.round((clampedProgress / 100) * 2540);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Icon
            name="download-outline"
            size={40}
            color={colors.primary}
          />
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {error ? 'Download Failed' : 'Setting up MindSafe'}
        </Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          {error
            ? error
            : clampedProgress < 100
            ? 'Downloading the AI model to your device.\nThis only happens once.'
            : 'Almost ready...'}
        </Text>

        {/* Progress bar */}
        {!error && (
          <View style={styles.progressSection}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${clampedProgress}%` },
                ]}
              />
            </View>

            <View style={styles.progressInfo}>
              <Text style={styles.progressPercent}>
                {clampedProgress}%
              </Text>
              <Text style={styles.progressSize}>
                {downloadedMB} / 2,540 MB
              </Text>
            </View>
          </View>
        )}

        {/* Retry button on error */}
        {error && onRetry && (
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryPressed,
            ]}
            onPress={onRetry}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        )}

        {/* Hints */}
        {!error && (
          <View style={styles.hints}>
            <View style={styles.hintRow}>
              <Icon name="wifi" size={14} color={colors.textSecondary} />
              <Text style={styles.hintText}>
                Keep the app open and stay on WiFi
              </Text>
            </View>
            <View style={styles.hintRow}>
              <Icon
                name="lock-outline"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.hintText}>
                The model stays on your device only
              </Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },

  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  title: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },

  // Progress bar
  progressSection: {
    width: '100%',
    marginBottom: 48,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.divider,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  progressSize: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.textSecondary,
  },

  // Retry
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: colors.primary,
    borderRadius: 10,
    marginBottom: 20,
  },
  retryPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },

  // Hints
  hints: {
    gap: 12,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
