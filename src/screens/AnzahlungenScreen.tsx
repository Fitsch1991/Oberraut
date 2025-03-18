import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { supabase } from '../supabaseClient';
import Header from '../components/Header';

type Buchung = {
  id: number;
  zimmer_id: number;
  gast_id: number | null;
  check_in: string;
  check_out: string;
  anzahlung: number;
  status: string;
};

type Gast = {
  id: number;
  vorname: string;
  nachname: string;
};

type AnzahlungenScreenProps = {
  onRefresh?: () => void;
};

const AnzahlungenScreen: React.FC<AnzahlungenScreenProps> = ({ onRefresh }) => {
  const [buchungen, setBuchungen] = useState<Buchung[]>([]);
  const [gaeste, setGaeste] = useState<Gast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: buchungenData, error: buchungenError } = await supabase
        .from('buchungen')
        .select('*')
        .or('status.eq.anzahlung,status.eq.anzahlung_bezahlt')
        .gte('check_in', today)
        .order('check_in', { ascending: true });

      if (buchungenError) throw buchungenError;
      if (buchungenData) setBuchungen(buchungenData);

      const { data: gaesteData, error: gaesteError } = await supabase
        .from('gaeste')
        .select('*');

      if (gaesteError) throw gaesteError;
      if (gaesteData) setGaeste(gaesteData);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      Alert.alert('Fehler', 'Daten konnten nicht geladen werden.');
    }
  };

  useEffect(() => {
    fetchData();

    // Alle 2 Minuten Daten abrufen
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, []);

  // Optionale externe onRefresh-Aktion (falls übergeben)
  useEffect(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh]);

  const updateStatus = async (buchungId: number, neuerStatus: 'anzahlung' | 'anzahlung_bezahlt') => {
    try {
      const { error } = await supabase
        .from('buchungen')
        .update({ status: neuerStatus })
        .eq('id', buchungId);

      if (error) throw error;

      Alert.alert('Erfolg', 'Status erfolgreich geändert.');
      // Nach Statusänderung Daten neu laden
      fetchData();
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Status:', error);
      Alert.alert('Fehler', 'Status konnte nicht geändert werden.');
    }
  };

  const filteredBuchungen = searchQuery
    ? buchungen.filter(b => {
        const gast = gaeste.find(g => g.id === b.gast_id);
        if (!gast) return false;
        const fullName = `${gast.vorname} ${gast.nachname}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
      })
    : buchungen;

  const offeneAnzahlungenSumme = filteredBuchungen
    .filter(b => b.status === 'anzahlung' && new Date(b.check_in) > new Date())
    .reduce((sum, b) => sum + b.anzahlung, 0);

  const bezahlteAnzahlungenSumme = filteredBuchungen
    .filter(b => b.status === 'anzahlung_bezahlt' && new Date(b.check_out) > new Date())
    .reduce((sum, b) => sum + b.anzahlung, 0);

  return (
    <ScrollView style={styles.container}>
      <Header />
      <Text style={styles.title}>Anzahlungen</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Gäste suchen..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <Text style={styles.sectionTitle}>
        Offene Anzahlungen ({offeneAnzahlungenSumme} €)
      </Text>
      {filteredBuchungen
        .filter(b => b.status === 'anzahlung')
        .map(b => {
          const gast = gaeste.find(g => g.id === b.gast_id);
          return (
            <View key={b.id} style={styles.card}>
              <Text>
                <Text style={styles.boldText}>
                  {gast ? `${gast.vorname} ${gast.nachname}` : 'Unbekannter Gast'}
                </Text>
                {' - '}
                {b.check_in} bis {b.check_out}
              </Text>
              <Text>Anzahlung: {b.anzahlung} €</Text>

              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[
                    styles.radioButton,
                    b.status === 'anzahlung' && styles.radioButtonRed,
                  ]}
                  onPress={() => updateStatus(b.id, 'anzahlung')}
                >
                  <Text style={styles.radioText}>Nicht bezahlt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.radioButton,
                    b.status === 'anzahlung_bezahlt' && styles.radioButtonGreen,
                  ]}
                  onPress={() => updateStatus(b.id, 'anzahlung_bezahlt')}
                >
                  <Text style={styles.radioText}>Bezahlt</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

      <Text style={styles.sectionTitle}>
        Bezahlte Anzahlungen ({bezahlteAnzahlungenSumme} €)
      </Text>
      {filteredBuchungen
        .filter(b => b.status === 'anzahlung_bezahlt')
        .map(b => {
          const gast = gaeste.find(g => g.id === b.gast_id);
          return (
            <View key={b.id} style={styles.card}>
              <Text>
                <Text style={styles.boldText}>
                  {gast ? `${gast.vorname} ${gast.nachname}` : 'Unbekannter Gast'}
                </Text>
                {' - '}
                {b.check_in} bis {b.check_out}
              </Text>
              <Text>Anzahlung: {b.anzahlung} €</Text>

              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[
                    styles.radioButton,
                    b.status === 'anzahlung' && styles.radioButtonRed,
                  ]}
                  onPress={() => updateStatus(b.id, 'anzahlung')}
                >
                  <Text style={styles.radioText}>Nicht bezahlt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.radioButton,
                    b.status === 'anzahlung_bezahlt' && styles.radioButtonGreen,
                  ]}
                  onPress={() => updateStatus(b.id, 'anzahlung_bezahlt')}
                >
                  <Text style={styles.radioText}>Bezahlt</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  searchInput: { borderWidth: 1, borderColor: '#ccc', padding: 8, marginBottom: 16, borderRadius: 4 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 6, marginBottom: 12 },
  boldText: { fontWeight: 'bold' },
  radioGroup: { flexDirection: 'row', marginTop: 8 },
  radioButton: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginRight: 8,
  },
  radioButtonRed: { backgroundColor: '#FF5733', borderColor: '#FF5733' },
  radioButtonGreen: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  radioText: { fontSize: 16, color: '#000' },
});

export default AnzahlungenScreen;
