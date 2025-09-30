import { useEffect } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../../src/auth/AuthContext';

// This screen exists so that Expo Router can render a tab for `logout`.
// It immediately triggers signOut when focused/mounted.
export default function LogoutScreen() {
  const { signOut } = useAuth();

  useEffect(() => {
    signOut();
  }, [signOut]);

  return <View />;
}
