// src/screens/LoginScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../supabaseClient';
import Header from '../components/Header';

type RootStackParamList = {
  Login: undefined;
  Home: undefined;
};

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Login'
>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const lastLogin = await AsyncStorage.getItem('lastLogin');
        const { data: { session } } = await supabase.auth.getSession();
        if (lastLogin && session) {
          const lastLoginTime = new Date(parseInt(lastLogin));
          const now = new Date();
          const differenceInHours = (now.getTime() - lastLoginTime.getTime()) / (1000 * 60 * 60);
          if (differenceInHours < 24) {
            navigation.replace('Home');
            return;
          }
        }
      } catch (error) {
        console.error('Fehler beim Prüfen der gespeicherten Anmeldung:', error);
      }
      setLoading(false);
    };

    checkLoginStatus();
  }, []);

  const handleLogin = async () => {
    setErrorMsg('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        setErrorMsg(error ? error.message : 'Login fehlgeschlagen');
        setLoading(false);
      } else {
        await AsyncStorage.setItem('lastLogin', Date.now().toString());
        navigation.replace('Home');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Prüfe Login...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />
      <Text style={styles.title}>Login</Text>
      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="E-Mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Passwort"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title="Einloggen" onPress={handleLogin} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    marginBottom: 20,
    textAlign: 'center',
  },
  error: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

