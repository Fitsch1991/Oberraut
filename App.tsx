import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import NetInfo from '@react-native-community/netinfo';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AnzahlungenScreen from './src/screens/AnzahlungenScreen';
import EinstellungenScreen from './src/screens/EinstellungenScreen';
import { supabase } from './src/supabaseClient';

const Stack = createNativeStackNavigator();

export default function App() {
  const [buchungen, setBuchungen] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(true);

  // Vollständiges Laden der Buchungen (ohne Soft‑Delete)
  const syncFullBuchungen = useCallback(async () => {
    if (!isConnected) return;
    try {
      console.log("🔄 Vollständiges Laden der Buchungen...");
      const { data, error } = await supabase
        .from('buchungen')
        .select('*')
        .is('deleted_at', null);
      if (error) {
        console.error("❌ Fehler beim Voll-Laden der Buchungen:", error);
        return;
      }
      console.log("📥 Vollständig geladene Buchungen:", data);
      if (data) {
        setBuchungen(data);
      }
    } catch (error) {
      console.error("⚠️ Fehler in syncFullBuchungen:", error);
    }
  }, [isConnected]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    // Initialer Datenabruf
    syncFullBuchungen();

    // Alle 2 Minuten alle Buchungen neu laden
    const fullInterval = setInterval(syncFullBuchungen, 120000);

    return () => {
      clearInterval(fullInterval);
      unsubscribe();
    };
  }, [syncFullBuchungen]);

  console.log("📊 Buchungen in App.tsx:", buchungen);

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen 
          name="Calendarscreen" 
          children={() => <CalendarScreen buchungen={buchungen} onRefresh={syncFullBuchungen} />} 
        />
        <Stack.Screen 
          name="AnzahlungenScreen" 
          children={() => <AnzahlungenScreen onRefresh={syncFullBuchungen} />} 
        />
        <Stack.Screen name="EinstellungenScreen" component={EinstellungenScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
