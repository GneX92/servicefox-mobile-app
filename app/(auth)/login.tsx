import { AtSign, Eye, EyeOff, Lock } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, View } from 'react-native';
import WtkLogo from '../../assets/images/wtk.svg';
import { Alert, AlertIcon, AlertText } from '../../components/ui/alert';
import { Button, ButtonSpinner, ButtonText } from '../../components/ui/button';
import { FormControl, FormControlLabel, FormControlLabelText } from '../../components/ui/form-control';
import { EyeOffIcon } from '../../components/ui/icon';
import { Input, InputField, InputSlot } from '../../components/ui/input';
import { useAuth } from '../../src/auth/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // Redirect happens automatically via layouts
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-background-0 px-6 py-8">
      <View className="flex-1 justify-center">
        <View className="items-center mb-6">
          <Image
            source={require('../../assets/images/servicefox.png')}
            style={{ width: 300, height: 300 }}
            resizeMode="contain"
          />
        </View>

        <View className="gap-5">
        <FormControl size="lg">
          <FormControlLabel>
            <FormControlLabelText>Email</FormControlLabelText>
          </FormControlLabel>
          <Input size="lg">
            <InputSlot className="pl-3">
              <AtSign size={20} color="#9AAAAA" />
              {/* <InputIcon as={AtSignIcon} /> */}
            </InputSlot>
            <InputField
              value={email}
              onChangeText={setEmail}
              placeholder="name@waterkotte.de"
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
            />
          </Input>
        </FormControl>

        <FormControl size="lg">
          <FormControlLabel>
            <FormControlLabelText>Password</FormControlLabelText>
          </FormControlLabel>
          <Input size="lg">
            <InputSlot className="pl-3">
              <Lock size={20} color="#9AAAAA" />
              {/* <InputIcon as={Lock} /> */}
            </InputSlot>
            <InputField
              value={password}
              onChangeText={setPassword}
              placeholder="password"
              secureTextEntry={!showPassword}
              textContentType="password"
              autoComplete="password"
            />
            <InputSlot
              className="pr-3"
              onPress={() => setShowPassword((s) => !s)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={20} color="#9AAAAA" /> : <Eye size={20} color="#9AAAAA" />}
              {/* <InputIcon as={showPassword ? EyeOffIcon : EyeIcon} /> */}
            </InputSlot>
          </Input>
        </FormControl>

        {error ? (
          <Alert action="error" variant="solid">
            <AlertIcon as={EyeOffIcon} />
            <AlertText>{error}</AlertText>
          </Alert>
        ) : null}

        <Button onPress={onSubmit} disabled={submitting} action="primary" size="lg">
          {submitting ? (
            <>
              <ButtonSpinner />
              <ButtonText>Logging in…</ButtonText>
            </>
          ) : (
            <ButtonText style={{ color: "white"}}>Log in</ButtonText>
          )}
        </Button>
        </View>
      </View>
      <View className="items-center mt-8 opacity-80">
        <WtkLogo width={300} height={78} />
      </View>
    </View>
  );
}
