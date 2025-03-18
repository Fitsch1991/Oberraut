import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet, FlatList, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import { useNavigation } from '@react-navigation/native';

const EinstellungenScreen = () => {
  const [ferienStart, setFerienStart] = useState('');
  const [ferienEnde, setFerienEnde] = useState('');
  const [ferienListe, setFerienListe] = useState([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentEdit, setCurrentEdit] = useState(null); // {check_in, check_out}
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const navigation = useNavigation();

  // Ferien aus Supabase abrufen: Nur Ferien, deren check_out-Datum nach heute liegt
  const fetchFerien = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('buchungen')
        .select('check_in, check_out')
        .eq('status', 'Ferien')
        .gt('check_out', today);
      if (error) throw error;
      if (data) {
        // Gruppieren, damit gleiche Zeiträume nur einmal angezeigt werden
        const grouped = {};
        data.forEach(item => {
          const key = `${item.check_in}_${item.check_out}`;
          grouped[key] = { check_in: item.check_in, check_out: item.check_out };
        });
        setFerienListe(Object.values(grouped));
      }
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    }
  };

  useEffect(() => {
    fetchFerien();
  }, []);

  // Ferien eintragen
  const handleFerienEintragen = async () => {
    if (!ferienStart || !ferienEnde) {
      Alert.alert('Fehler', 'Bitte Start- und Enddatum angeben.');
      return;
    }

    try {
      const { data: overlappingBookings, error: overlapError } = await supabase
        .from('buchungen')
        .select('zimmer_id')
        .filter('check_in', 'lt', ferienEnde)
        .filter('check_out', 'gt', ferienStart);

      if (overlapError) throw overlapError;
      if (overlappingBookings && overlappingBookings.length > 0) {
        Alert.alert('Nicht möglich', 'In mindestens einem Zimmer existiert bereits eine Buchung in diesem Zeitraum.');
        return;
      }

      const { data: zimmerData, error: zimmerError } = await supabase
        .from('zimmer')
        .select('id');
      if (zimmerError) throw zimmerError;
      if (!zimmerData || zimmerData.length === 0) {
        Alert.alert('Fehler', 'Keine Zimmer gefunden.');
        return;
      }

      const { data: existingFerienGuest } = await supabase
        .from('gaeste')
        .select('id')
        .eq('vorname', 'Ferien')
        .eq('nachname', 'Ferien');
      let ferienGuestId;
      if (existingFerienGuest && existingFerienGuest.length > 0) {
        ferienGuestId = existingFerienGuest[0].id;
      } else {
        const { data: newGuest, error: guestError } = await supabase
          .from('gaeste')
          .insert([{ vorname: 'Ferien', nachname: 'Ferien' }])
          .select('*')
          .single();
        if (guestError) throw guestError;
        ferienGuestId = newGuest.id;
      }

      const bookings = zimmerData.map((zimmer: { id: number }) => ({
        zimmer_id: zimmer.id,
        gast_id: ferienGuestId,
        check_in: ferienStart,
        check_out: ferienEnde,
        anzahl_personen: 0,
        preis_pro_person: 0,
        anzahlung: 0,
        status: 'Ferien',
        verpflegung: '',
        hund: false,
        zusatz_preis: '',
        tel_email: '',
        notiz: 'Ferienbuchung',
      }));

      const { error: insertError } = await supabase
        .from('buchungen')
        .insert(bookings);
      if (insertError) throw insertError;

      Alert.alert('Erfolg', 'Ferien erstellt.');
      setFerienStart('');
      setFerienEnde('');
      fetchFerien();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Fehler', error.message);
    }
  };

  // Ferien löschen
  const handleFerienLöschen = async (check_in: string, check_out: string) => {
    try {
      const { error } = await supabase
        .from('buchungen')
        .delete()
        .eq('status', 'Ferien')
        .eq('check_in', check_in)
        .eq('check_out', check_out);
      if (error) throw error;
      Alert.alert('Erfolg', 'Ferien gelöscht.');
      fetchFerien();
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    }
  };

  // Ferien bearbeiten (verlängern/verkürzen)
  const handleFerienBearbeiten = async () => {
    if (!newStart || !newEnd || !currentEdit) {
      Alert.alert('Fehler', 'Bitte neue Start- und Enddaten angeben.');
      return;
    }
    try {
      const { error } = await supabase
        .from('buchungen')
        .update({ check_in: newStart, check_out: newEnd })
        .eq('status', 'Ferien')
        .eq('check_in', currentEdit.check_in)
        .eq('check_out', currentEdit.check_out);
      if (error) throw error;
      Alert.alert('Erfolg', 'Ferien aktualisiert.');
      setEditModalVisible(false);
      setCurrentEdit(null);
      fetchFerien();
    } catch (error: any) {
      Alert.alert('Fehler', error.message);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.clear();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error: any) {
      Alert.alert('Fehler', error.message || 'Logout fehlgeschlagen.');
    }
  };

  const renderFerienItem = ({ item }) => (
    <View style={styles.ferienItem}>
      <Text>{item.check_in} bis {item.check_out}</Text>
      <View style={styles.ferienButtons}>
        <Button title="Bearbeiten" onPress={() => {
          setCurrentEdit(item);
          setNewStart(item.check_in);
          setNewEnd(item.check_out);
          setEditModalVisible(true);
        }} />
        <Button title="Löschen" onPress={() => handleFerienLöschen(item.check_in, item.check_out)} color="red" />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Einstellungen</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ferien eintragen</Text>
        <TextInput
          style={styles.input}
          placeholder="Startdatum (YYYY-MM-DD)"
          value={ferienStart}
          onChangeText={setFerienStart}
        />
        <TextInput
          style={styles.input}
          placeholder="Enddatum (YYYY-MM-DD)"
          value={ferienEnde}
          onChangeText={setFerienEnde}
        />
        <Button title="Ferien eintragen" onPress={handleFerienEintragen} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bevorstehende Ferien</Text>
        <FlatList
          data={ferienListe}
          keyExtractor={(item) => item.check_in + '_' + item.check_out}
          renderItem={renderFerienItem}
          ListEmptyComponent={<Text>Keine Ferien eingetragen.</Text>}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Logout</Text>
        <Button title="Logout" onPress={handleLogout} color="red" />
      </View>

      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text>Ferien bearbeiten</Text>
            <TextInput
              style={styles.input}
              placeholder="Neues Startdatum (YYYY-MM-DD)"
              value={newStart}
              onChangeText={setNewStart}
            />
            <TextInput
              style={styles.input}
              placeholder="Neues Enddatum (YYYY-MM-DD)"
              value={newEnd}
              onChangeText={setNewEnd}
            />
            <Button title="Speichern" onPress={handleFerienBearbeiten} />
            <Button title="Abbrechen" onPress={() => setEditModalVisible(false)} color="red" />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 },
  section: { marginBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  ferienItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ferienButtons: { flexDirection: 'row' },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%'
  }
});

export default EinstellungenScreen;
