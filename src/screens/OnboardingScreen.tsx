import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../utils/theme';
import { useAppStore } from '../store/useAppStore';
import { downloadModel, isModelDownloaded } from '../services/llm/ModelDownloader';
import DatabaseService from '../services/database/DatabaseService';
import EncryptionService from '../services/EncryptionService';
import LoadingModel from '../components/common/LoadingModel';
import type { RootStackParamList } from '../app/Navigation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive scaling: shrink spacing/hero on smaller screens
const isSmall = SCREEN_HEIGHT < 720;
const isMedium = SCREEN_HEIGHT < 800;

const HERO_HEIGHT = isSmall ? 110 : isMedium ? 140 : 180;
const HERO_MARGIN_V = isSmall ? 20 : isMedium ? 28 : 36;
const PROP_GAP = isSmall ? 10 : isMedium ? 14 : 20;
const PROP_PADDING = isSmall ? 12 : 16;
const PROPS_MB = isSmall ? 20 : isMedium ? 28 : 40;
const HERO_ICON_SIZE = isSmall ? 44 : 56;

const VALUE_PROPS = [
  { icon: 'lock-outline', text: 'AI runs entirely on your phone' },
  { icon: 'shield-outline', text: 'No cloud. No servers. No tracking.' },
  { icon: 'heart-outline', text: 'Thoughtful support, whenever you need it' },
];

export default function OnboardingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { setOnboarded, setModelStatus, setModelProgress } = useAppStore();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleGetStarted = async () => {
    setError(null);

    try {
      await DatabaseService.initialize();
      await EncryptionService.initialize();

      const alreadyDownloaded = await isModelDownloaded();

      if (!alreadyDownloaded) {
        // Request POST_NOTIFICATIONS permission on Android 13+ so the
        // background-download progress notification can be displayed.
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
        }

        setIsDownloading(true);
        setModelStatus('downloading');

        await downloadModel((percent) => {
          setDownloadProgress(percent);
          setModelProgress(percent);
        });
      }

      setModelStatus('downloaded');
      await DatabaseService.setSetting('onboarded', 'true');
      setOnboarded(true);
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (err: any) {
      setError(err.message || 'Download failed. Please try again.');
      setIsDownloading(false);
      setModelStatus('error');
    }
  };

  if (isDownloading) {
    return (
      <LoadingModel
        progress={downloadProgress}
        error={error}
        onRetry={handleGetStarted}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>MindSafe</Text>
          <Text style={styles.subtitle}>
            Your mind. Your device. Your rules.
          </Text>
        </View>

        {/* Hero */}
        <View style={[styles.heroContainer, { height: HERO_HEIGHT, marginVertical: HERO_MARGIN_V }]}>
          <Icon
            name="spa-outline"
            size={HERO_ICON_SIZE}
            color="rgba(44,41,38,0.15)"
          />
        </View>

        {/* Value Propositions */}
        <View style={[styles.propsSection, { gap: PROP_GAP, marginBottom: PROPS_MB }]}>
          {VALUE_PROPS.map((prop, index) => (
            <View key={index} style={[styles.propCard, { padding: PROP_PADDING }]}>
              <View style={styles.iconCircle}>
                <Icon name={prop.icon} size={18} color={colors.textPrimary} />
              </View>
              <Text style={styles.propText}>{prop.text}</Text>
            </View>
          ))}
        </View>

        {/* Footer — pinned to bottom via flex spacer */}
        <View style={styles.spacer} />

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleGetStarted}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </Pressable>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.footerTextContainer}>
            <Text style={styles.footerMono}>
              A 2.5 GB AI MODEL WILL BE DOWNLOADED OVER WIFI
            </Text>
            <Text style={styles.footerRegular}>No account required</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -0.5,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textSecondary,
  },

  // Hero
  heroContainer: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surfaceCardSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Value propositions
  propsSection: {
    width: '100%',
  },
  propCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceCard,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.iconCircleBg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  propText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '400',
    color: colors.textPrimary,
  },

  // Spacer pushes footer to bottom
  spacer: {
    flex: 1,
    minHeight: 8,
  },

  // Footer
  footer: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 13,
    color: '#BA1A1A',
    marginTop: 12,
    textAlign: 'center',
  },
  footerTextContainer: {
    marginTop: 12,
    alignItems: 'center',
    gap: 2,
  },
  footerMono: {
    fontSize: 11,
    fontFamily: 'monospace',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    opacity: 0.8,
  },
  footerRegular: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});
