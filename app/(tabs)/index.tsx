import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import {
  Camera,
  FlipHorizontal,
  ImagePlus,
  Zap,
  RotateCcw,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

async function pickImageFromLibrary(): Promise<{ uri: string; base64: string | null } | null> {
  if (Platform.OS === 'web') {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        const uri = URL.createObjectURL(file);
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1] ?? null;
          resolve({ uri, base64 });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  // Native path
  const ImagePicker = await import('expo-image-picker');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    base64: true,
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return { uri: result.assets[0].uri, base64: result.assets[0].base64 ?? null };
}

export default function CaptureScreen() {
  const router = useRouter();
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.8 });
      if (photo) {
        setCapturedUri(photo.uri);
        setBase64(photo.base64 ?? null);
      }
    } catch {
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    }
  }, []);

  const pickImage = useCallback(async () => {
    const result = await pickImageFromLibrary();
    if (result) {
      setCapturedUri(result.uri);
      setBase64(result.base64);
    }
  }, []);

  const retake = useCallback(() => {
    setCapturedUri(null);
    setBase64(null);
  }, []);

  const analyze = useCallback(() => {
    if (!capturedUri) return;
    router.push({
      pathname: '/analyze',
      params: {
        imageUri: capturedUri,
        imageBase64: base64 ?? '',
      },
    });
  }, [capturedUri, base64, router]);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Camera size={56} color="#0F766E" strokeWidth={1.5} />
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permSubtitle}>
          We need camera access to photograph products for listing on Shopify.
        </Text>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.permSecondary} onPress={pickImage}>
          <Text style={styles.permSecondaryText}>Choose from Library Instead</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (capturedUri) {
    return (
      <SafeAreaView style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>Review Photo</Text>
          <Text style={styles.previewSubtitle}>
            Make sure the product is clearly visible
          </Text>
        </View>
        <View style={styles.previewImageWrap}>
          <Image source={{ uri: capturedUri }} style={styles.previewImage} resizeMode="cover" />
        </View>
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.retakeButton} onPress={retake}>
            <RotateCcw size={20} color="#0F766E" />
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.analyzeButton} onPress={analyze}>
            <Zap size={20} color="#FFFFFF" />
            <Text style={styles.analyzeText}>Analyze with AI</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Web fallback — no live camera view, just pick from library
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.webCaptureContainer}>
        <View style={styles.webIconWrap}>
          <Camera size={64} color="#0F766E" strokeWidth={1.3} />
        </View>
        <Text style={styles.webTitle}>Product Capture</Text>
        <Text style={styles.webSubtitle}>
          Select a product photo from your device to identify it with AI and list it on Shopify.
        </Text>
        <TouchableOpacity style={styles.webPickButton} onPress={pickImage}>
          <ImagePlus size={20} color="#FFFFFF" />
          <Text style={styles.webPickText}>Choose Photo</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
        <SafeAreaView style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraTitle}>Product Capture</Text>
            <Text style={styles.cameraHint}>Center the product in the frame</Text>
          </View>

          <View style={styles.framingGuide}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.secondaryControl} onPress={pickImage}>
              <ImagePlus size={24} color="#FFFFFF" />
              <Text style={styles.controlLabel}>Library</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shutterButton} onPress={takePicture}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryControl}
              onPress={() => setFacing(f => (f === 'back' ? 'front' : 'back'))}
            >
              <FlipHorizontal size={24} color="#FFFFFF" />
              <Text style={styles.controlLabel}>Flip</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const CORNER = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  cameraHeader: { alignItems: 'center', paddingTop: 16 },
  cameraTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cameraHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  framingGuide: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    bottom: '20%',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#FFFFFF',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  topRight: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  secondaryControl: { alignItems: 'center', gap: 4, width: 64 },
  controlLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '500' },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  permTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  permSubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  permButton: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  permButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  permSecondary: { paddingVertical: 8 },
  permSecondaryText: { color: '#0F766E', fontSize: 15, fontWeight: '500' },
  previewContainer: { flex: 1, backgroundColor: '#0F172A' },
  previewHeader: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  previewTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  previewSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  previewImageWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
  previewActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#0F766E',
    paddingVertical: 14,
    borderRadius: 12,
  },
  retakeText: { color: '#0F766E', fontSize: 15, fontWeight: '600' },
  analyzeButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F766E',
    paddingVertical: 14,
    borderRadius: 12,
  },
  analyzeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  webCaptureContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 20,
  },
  webIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0FDFA',
    borderWidth: 2,
    borderColor: '#99F6E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A' },
  webSubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 23,
  },
  webPickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F766E',
    paddingHorizontal: 32,
    paddingVertical: 15,
    borderRadius: 14,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  webPickText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
