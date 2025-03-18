import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import Modal from 'react-native-modal';
import { supabase } from '../supabaseClient';

function myAlert(title: string, msg: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${msg}`);
  } else {
    Alert.alert(title, msg);
  }
}

type RadioGroupProps = {
  options: { label: string; value: string }[];
  selectedValue: string;
  onChange: (value: string) => void;
};

const RadioGroup: React.FC<RadioGroupProps> = memo(({ options, selectedValue, onChange }) => {
  return (
    <View style={styles.radioGroup}>
      {options.map((opt) => {
        const isSelected = opt.value === selectedValue;
        return (
          <TouchableWithoutFeedback key={opt.value} onPress={() => onChange(opt.value)}>
            <View style={[styles.radioOption, isSelected && styles.radioOptionSelected]}>
              <Text style={[styles.radioLabel, isSelected && styles.radioLabelSelected]}>
                {opt.label}
              </Text>
            </View>
          </TouchableWithoutFeedback>
        );
      })}
    </View>
  );
});

type BookingFormModalProps = {
  isVisible: boolean;
  checkIn: string;
  checkOut: string;
  onClose: () => void;
  onSubmit: (data: {
    guestName: string;
    personCount: number;
    status: string;
    anzahlung: number;
    verpflegung: string;
    preisProPerson: number | null;
    hund: boolean;
    zusatzPreis: string;
    notiz: string;
    tel_email: string;
  }) => Promise<void>;
  onRefresh?: () => Promise<void>;
  initialGuestName?: string;
  initialPersonCount?: number;
  // Das Zimmer wurde bereits gewählt
  selectedRoomId?: number;
};

const statusOptions = [
  { label: 'Belegt', value: 'belegt' },
  { label: 'Anzahlung', value: 'anzahlung' },
  { label: 'Anz. bez', value: 'anzahlung_bezahlt' },
];
const verpflegungOptions = [
  { label: 'Frühstück', value: 'Frühstück' },
  { label: 'Halbpension', value: 'Halbpension' },
];
const hundOptions = [
  { label: 'Nein', value: 'nein' },
  { label: 'Ja', value: 'ja' },
];

const BookingFormModal: React.FC<BookingFormModalProps> = ({
  isVisible,
  checkIn,
  checkOut,
  onClose,
  onSubmit,
  onRefresh,
  initialGuestName = '',
  initialPersonCount = 0,
  selectedRoomId,
}) => {
  const [guestName, setGuestName] = useState(initialGuestName);
  const [personCount, setPersonCount] = useState(initialPersonCount.toString());
  const [status, setStatus] = useState('belegt');
  const [anzahlung, setAnzahlung] = useState('0');
  const [verpflegung, setVerpflegung] = useState('Frühstück');
  const [preisProPerson, setPreisProPerson] = useState('');
  const [hund, setHund] = useState('nein');
  const [zusatzPreis, setZusatzPreis] = useState('');
  const [telEmail, setTelEmail] = useState('');
  const [notiz, setNotiz] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Beim Öffnen des Modals initialisieren wir den Zustand
  useEffect(() => {
    if (isVisible) {
      setGuestName(initialGuestName);
      setPersonCount(initialPersonCount.toString());
      setStatus('belegt');
      setAnzahlung('0');
      setVerpflegung('Frühstück');
      setPreisProPerson('');
      setHund('nein');
      setZusatzPreis('');
      setTelEmail('');
      setNotiz('');
      setIsSubmitting(false);
    }
  }, [isVisible, initialGuestName, initialPersonCount]);

  useEffect(() => {
    if (anzahlung.trim() !== '' && anzahlung !== '0') {
      setStatus('anzahlung');
    }
  }, [anzahlung]);

  const isFormValid =
    guestName.trim().split(' ').length >= 2 &&
    !isNaN(parseInt(personCount)) &&
    parseInt(personCount) > 0;

  // Prüfen, ob das ausgewählte Zimmer im angegebenen Zeitraum verfügbar ist
  const validateRoomAvailability = useCallback(
    async (roomId: number, newCheckIn: string, newCheckOut: string): Promise<boolean> => {
      const { data, error } = await supabase
        .from('buchungen')
        .select('id')
        .eq('zimmer_id', roomId)
        .is('deleted_at', null)
        .filter('check_in', 'lt', newCheckOut)
        .filter('check_out', 'gt', newCheckIn);
      if (error) {
        myAlert('Fehler', 'Fehler bei der Verfügbarkeitsprüfung.');
        return false;
      }
      return data && data.length === 0;
    },
    []
  );

  const handleCreate = useCallback(async () => {
    if (isSubmitting) return;
    if (!selectedRoomId) {
      myAlert('Fehler', 'Kein Zimmer ausgewählt.');
      return;
    }
    const count = parseInt(personCount);
    if (isNaN(count) || count <= 0) {
      myAlert('Fehler', 'Bitte eine gültige Anzahl an Personen eingeben.');
      return;
    }
    setIsSubmitting(true);
    try {
      const parsedAnzahlung = parseFloat(anzahlung);
      const parsedPreisProPerson = preisProPerson.trim() === '' ? null : parseFloat(preisProPerson);
      const parsedZusatzPreis = zusatzPreis.trim();
      console.log('Submitting booking with data:', {
        guestName,
        personCount: count,
        status,
        anzahlung: isNaN(parsedAnzahlung) ? 0 : parsedAnzahlung,
        verpflegung,
        preisProPerson: parsedPreisProPerson,
        hund: hund === 'ja',
        zusatzPreis: parsedZusatzPreis,
        notiz,
        tel_email: telEmail,
      });

      const nameParts = guestName.trim().split(' ');
      if (nameParts.length < 2) {
        myAlert('Fehler', 'Bitte Vor- und Nachname eingeben.');
        setIsSubmitting(false);
        return;
      }

      let guestId: number | null = null;
      const { data: existingGuest, error: existingGuestError } = await supabase
        .from('gaeste')
        .select('id')
        .eq('vorname', nameParts[0])
        .eq('nachname', nameParts[1]);
      if (existingGuestError) {
        console.log('Fehler bei der Gast-Suche', existingGuestError);
      }
      if (existingGuest && existingGuest.length > 0) {
        guestId = existingGuest[0].id;
      } else {
        const { data: newGuest } = await supabase
          .from('gaeste')
          .insert([{ vorname: nameParts[0], nachname: nameParts[1] }])
          .select('*')
          .single();
        if (!newGuest) {
          myAlert('Fehler', 'Gast konnte nicht erstellt werden.');
          setIsSubmitting(false);
          return;
        }
        guestId = newGuest.id;
      }

      const available = await validateRoomAvailability(selectedRoomId, checkIn, checkOut);
      if (!available) {
        myAlert('Fehler', 'Das Zimmer ist im angegebenen Zeitraum bereits vergeben.');
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.from('buchungen').insert([
        {
          zimmer_id: selectedRoomId,
          gast_id: guestId,
          check_in: checkIn,
          check_out: checkOut,
          anzahl_personen: count,
          preis_pro_person: parsedPreisProPerson ?? 0,
          anzahlung: isNaN(parsedAnzahlung) ? 0 : parsedAnzahlung,
          status,
          verpflegung,
          hund: hund === 'ja',
          zusatz_preis: parsedZusatzPreis,
          tel_email: telEmail,
          notiz,
        },
      ]);
      if (error) {
        myAlert('Fehler', error.message);
      } else {
        myAlert('Erfolg', 'Buchung erstellt!');
        onClose();
        if (onRefresh) await onRefresh();
      }
    } catch (err: any) {
      console.error('Fehler beim Erstellen der Buchung:', err);
      myAlert('Fehler', err.message || 'Unbekannter Fehler beim Erstellen der Buchung.');
    }
    setIsSubmitting(false);
  }, [
    isSubmitting,
    personCount,
    anzahlung,
    preisProPerson,
    zusatzPreis,
    guestName,
    status,
    verpflegung,
    hund,
    telEmail,
    notiz,
    checkIn,
    checkOut,
    selectedRoomId,
    onClose,
    onRefresh,
    validateRoomAvailability,
  ]);

  const content = (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Neue Buchung</Text>
          <Text>Check-In: {checkIn}</Text>
          <Text>Check-Out: {checkOut}</Text>
          <Text style={styles.label}>Gastname:</Text>
          <TextInput
            style={styles.input}
            placeholder="Vorname Nachname"
            value={guestName}
            onChangeText={setGuestName}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Personenanzahl:</Text>
          <TextInput
            style={styles.input}
            placeholder="z. B. 2"
            value={personCount}
            onChangeText={setPersonCount}
            keyboardType="numeric"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Status:</Text>
          <RadioGroup options={statusOptions} selectedValue={status} onChange={setStatus} />
          <Text style={styles.label}>Anzahlung:</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            value={anzahlung}
            onChangeText={setAnzahlung}
            keyboardType="numeric"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Verpflegung:</Text>
          <RadioGroup options={verpflegungOptions} selectedValue={verpflegung} onChange={setVerpflegung} />
          <Text style={styles.label}>Preis pro Person:</Text>
          <TextInput
            style={styles.input}
            placeholder="z. B. 50"
            value={preisProPerson}
            onChangeText={setPreisProPerson}
            keyboardType="numeric"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Hund:</Text>
          <RadioGroup options={hundOptions} selectedValue={hund} onChange={setHund} />
          <Text style={styles.label}>Zusatz Preis:</Text>
          <TextInput
            style={styles.input}
            placeholder="z. B. 10"
            value={zusatzPreis}
            onChangeText={setZusatzPreis}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Tel.: / email:</Text>
          <TextInput
            style={styles.input}
            placeholder="Telefon oder Email"
            value={telEmail}
            onChangeText={setTelEmail}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Notiz:</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="Notiz"
            value={notiz}
            onChangeText={setNotiz}
            multiline
            returnKeyType="done"
          />
          <View style={styles.buttonRow}>
            <Button title="Abbrechen" onPress={onClose} />
            {(checkIn.trim() !== '' && checkOut.trim() !== '') && (
              <Button title="Buchung erstellen" disabled={!isFormValid || isSubmitting} onPress={handleCreate} />
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      coverScreen
      useNativeDriver={false}
      style={styles.modalContainer}
      propagateSwipe
      avoidKeyboard
    >
      {Platform.OS === 'web' ? (
        content
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          {content}
        </TouchableWithoutFeedback>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: { margin: 0, justifyContent: 'flex-end' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center' },
  modalOverlay: { flexGrow: 1, backgroundColor: 'rgba(0,0,0,0.5)', padding: 16, justifyContent: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 8, padding: 16, width: '85%', alignSelf: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  label: { marginTop: 8, fontWeight: '600', marginBottom: 4, fontSize: 16 },
  input: { height: 40, fontSize: 16, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 4, color: 'black', marginBottom: 12 },
  radioGroup: { flexDirection: 'row', marginBottom: 12 },
  radioOption: { paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 4, marginRight: 8 },
  radioOptionSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  radioLabel: { fontSize: 16, color: 'black' },
  radioLabelSelected: { color: '#fff' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
});

export default memo(BookingFormModal);
