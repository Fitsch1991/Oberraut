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

  // 🔄 Lösche alte "deleted_at"-Buchungen (> 5 Tage)
  const deleteOldDeletedBuchungen = useCallback(async () => {
    if (!isConnected) return;

    try {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      console.log("🧹 Lösche Buchungen mit deleted_at älter als:", fiveDaysAgo.toISOString());

      const { error } = await supabase
        .from('buchungen')
        .delete()
        .lt('deleted_at', fiveDaysAgo.toISOString());

      if (error) {
        console.error("❌ Fehler beim Löschen alter Buchungen:", error);
      } else {
        console.log("✅ Alte gelöschte Buchungen erfolgreich entfernt.");
      }
    } catch (error) {
      console.error("⚠️ Fehler in deleteOldDeletedBuchungen:", error);
    }
  }, [isConnected]);

  // 📥 Vollständiges Laden der Buchungen (ohne Soft‑Delete)
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

    // 🧹 Alte Buchungen löschen
    deleteOldDeletedBuchungen();

    // 📥 Initialer Datenabruf
    syncFullBuchungen();

    // ⏱ Alle 2 Minuten neu laden
    const fullInterval = setInterval(syncFullBuchungen, 120000);

    return () => {
      clearInterval(fullInterval);
      unsubscribe();
    };
  }, [deleteOldDeletedBuchungen, syncFullBuchungen]);

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
