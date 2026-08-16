import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSignIn, useOAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Mail, Lock, ArrowRight, Store } from 'lucide-react-native';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow: startGoogle } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startApple } = useOAuth({ strategy: 'oauth_apple' });
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);

  const handleOAuth = useCallback(
    async (provider: 'google' | 'apple') => {
      setError('');
      setSocialLoading(provider);
      try {
        const startFlow = provider === 'google' ? startGoogle : startApple;
        const { createdSessionId, setActive: oauthSetActive } = await startFlow({
          redirectUrl: Linking.createURL('/'),
        });
        if (createdSessionId && oauthSetActive) {
          await oauthSetActive({ session: createdSessionId });
          router.replace('/(tabs)');
        }
      } catch (err: any) {
        setError(err.errors?.[0]?.longMessage ?? err.message ?? `${provider} sign in failed.`);
      } finally {
        setSocialLoading(null);
      }
    },
    [startGoogle, startApple],
  );

  const submit = async () => {
    if (!isLoaded) return;
    setError('');
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email.trim(), password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else {
        setError('Sign in could not be completed. Please try again.');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage ?? err.message ?? 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <View style={styles.logoIcon}>
              <Store size={32} color="#0F766E" strokeWidth={1.5} />
            </View>
            <Text style={styles.appName}>ShopSnap</Text>
            <Text style={styles.tagline}>AI-powered product listing</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in to your account</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Social login */}
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleOAuth('google')}
              disabled={socialLoading !== null || loading}
            >
              <Text style={styles.socialLogo}>G</Text>
              <Text style={styles.socialText}>
                {socialLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton]}
              onPress={() => handleOAuth('apple')}
              disabled={socialLoading !== null || loading}
            >
              <Text style={[styles.socialLogo, styles.appleLogoText]}></Text>
              <Text style={[styles.socialText, styles.appleText]}>
                {socialLoading === 'apple' ? 'Connecting...' : 'Continue with Apple'}
              </Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.inputWrap}>
                <Mail size={16} color="#94A3B8" />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputWrap}>
                <Lock size={16} color="#94A3B8" />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitDisabled]}
              onPress={submit}
              disabled={loading}
            >
              <Text style={styles.submitText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
              {!loading && <ArrowRight size={18} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
              <Text style={styles.switchLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 24,
  },
  logoWrap: { alignItems: 'center', gap: 10 },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  tagline: { fontSize: 14, color: '#64748B' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  cardSubtitle: { fontSize: 14, color: '#64748B', marginTop: -8 },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    lineHeight: 19,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  socialLogo: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4285F4',
    lineHeight: 20,
  },
  appleLogoText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  socialText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  appleText: {
    color: '#FFFFFF',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: { flex: 1, fontSize: 15, color: '#0F172A' },
  submitButton: {
    backgroundColor: '#0F766E',
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    alignItems: 'center',
  },
  switchText: { fontSize: 14, color: '#64748B' },
  switchLink: { fontSize: 14, fontWeight: '700', color: '#0F766E' },
});
