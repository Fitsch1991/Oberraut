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

export type BookingData = {
  id: number;
  zimmer_id: number;
  guestName: string;
  personCount: number;
  checkIn: string;
  checkOut: string;
  status: string;
  anzahlung: number;
  verpflegung: string;
  preisProPerson: number | null;
  hund: boolean;
  zusatz_preis: string;
  tel_email: string;
  zimmerNumber: string;
  notiz?: string;
};

type BookingEditModalProps = {
  isVisible: boolean;
  booking: BookingData;
  onClose: () => void;
  onUpdate: (updatedBooking: BookingData) => Promise<void>;
  onDelete: (bookingId: number) => Promise<void>;
  onRefresh?: () => void;
};

function myAlert(title: string, msg: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${msg}`);
  } else {
    Alert.alert(title, msg);
  }
}

async function myConfirm(question: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(question));
  } else {
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'Bestätigung',
        question,
        [
          { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) },
          { text: 'OK', style: 'default', onPress: () => resolve(true) },
        ],
        { cancelable: true }
      );
    });
  }
}

const RadioGroup: React.FC<{
  options: { label: string; value: string }[];
  selectedValue: string;
  onChange: (value: string) => void;
}> = memo(({ options, selectedValue, onChange }) => {
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

const sharedInputStyle = {
  height: 40,
  fontSize: 16,
  paddingVertical: 8,
  paddingHorizontal: 10,
  borderWidth: 1,
  borderColor: '#ccc',
  borderRadius: 4,
  color: 'black',
  marginBottom: 12,
  width: '100%',
};

const BookingEditModal: React.FC<BookingEditModalProps> = ({
  isVisible,
  booking,
  onClose,
  onUpdate,
  onDelete,
  onRefresh,
}) => {
  const [guestName, setGuestName] = useState(booking.guestName);
  const [personCount, setPersonCount] = useState(booking.personCount.toString());
  const [status, setStatus] = useState(booking.status);
  const [anzahlung, setAnzahlung] = useState(booking.anzahlung.toString());
  const [verpflegung, setVerpflegung] = useState(booking.verpflegung || 'Frühstück');
  const [preisProPerson, setPreisProPerson] = useState(
    booking.preisProPerson !== null ? booking.preisProPerson.toString() : ''
  );
  const [hund, setHund] = useState(booking.hund ? 'ja' : 'nein');
  const [zusatzPreis, setZusatzPreis] = useState(booking.zusatz_preis);
  const [telEmail, setTelEmail] = useState(booking.tel_email);
  const [zimmerNumber, setzimmerNumber] = useState(booking.zimmerNumber);
  const [checkIn, setCheckIn] = useState(booking.checkIn);
  const [checkOut, setCheckOut] = useState(booking.checkOut);
  const [notiz, setNotiz] = useState(booking.notiz || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setGuestName(booking.guestName);
    setPersonCount(booking.personCount.toString());
    setStatus(booking.status);
    setAnzahlung(booking.anzahlung.toString());
    setVerpflegung(booking.verpflegung || 'Frühstück');
    setPreisProPerson(booking.preisProPerson !== null ? booking.preisProPerson.toString() : '');
    setHund(booking.hund ? 'ja' : 'nein');
    setZusatzPreis(booking.zusatz_preis);
    setTelEmail(booking.tel_email);
    setzimmerNumber(booking.zimmerNumber);
    setCheckIn(booking.checkIn);
    setCheckOut(booking.checkOut);
    setNotiz(booking.notiz || '');
    setIsSubmitting(false);
  }, [booking]);

  const isFormValid =
    guestName.trim().split(' ').length >= 2 &&
    !isNaN(parseInt(personCount)) &&
    parseInt(personCount) > 0 &&
    checkIn.trim() !== '' &&
    checkOut.trim() !== '' &&
    zimmerNumber.trim() !== '';

  const handleUpdate = useCallback(async () => {
    if (isSubmitting) return;
    const count = parseInt(personCount);
    if (isNaN(count) || count <= 0) {
      myAlert('Fehler', 'Bitte eine gültige Anzahl an Personen eingeben.');
      return;
    }
    setIsSubmitting(true);
    const parsedAnzahlung = parseFloat(anzahlung);
    const parsedPreisProPerson = preisProPerson.trim() === '' ? null : parseFloat(preisProPerson);
    const newzimmerNumber = zimmerNumber.trim();
    if (!newzimmerNumber) {
      myAlert('Fehler', 'Bitte eine Zimmernummer angeben.');
      setIsSubmitting(false);
      return;
    }
    // Hier nehmen wir an, dass die Zimmernummer bereits korrekt ist.
    const { error } = await supabase
      .from('buchungen')
      .update({
        check_in: checkIn,
        check_out: checkOut,
        anzahl_personen: count,
        preis_pro_person: parsedPreisProPerson ?? 0,
        anzahlung: isNaN(parsedAnzahlung) ? 0 : parsedAnzahlung,
        status: status,
        verpflegung: verpflegung,
        hund: hund === 'ja',
        zusatz_preis: zusatzPreis,
        tel_email: telEmail,
        notiz,
      })
      .eq('id', booking.id);
    if (error) {
      myAlert('Fehler', error.message);
    } else {
      myAlert('Erfolg', 'Buchung aktualisiert!');
      if (onRefresh) await onRefresh();
      onClose();
    }
    setIsSubmitting(false);
  }, [
    isSubmitting,
    personCount,
    anzahlung,
    preisProPerson,
    zimmerNumber,
    checkIn,
    checkOut,
    status,
    verpflegung,
    hund,
    zusatzPreis,
    telEmail,
    notiz,
    booking.id,
    onRefresh,
    onClose,
  ]);

  const handleDelete = useCallback(async () => {
    if (isSubmitting) return;
    const confirmed = await myConfirm('Möchtest du die Buchung wirklich löschen?');
    if (confirmed) {
      setIsSubmitting(true);
      // Soft Delete: Setze deleted_at statt der Buchung endgültig zu löschen.
      const { error } = await supabase
        .from('buchungen')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', booking.id);
      if (error) {
        myAlert('Fehler', error.message);
      } else {
        myAlert('Erfolg', 'Buchung wurde soft-deleted!');
        if (onRefresh) await onRefresh();
        onClose();
      }
      setIsSubmitting(false);
    }
  }, [isSubmitting, booking.id, onRefresh, onClose]);

  const content = (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Buchung bearbeiten</Text>
          <Text>Aktueller Check-In: {booking.checkIn}</Text>
          <Text>Aktueller Check-Out: {booking.checkOut}</Text>
          <Text style={styles.label}>Zimmernummer:</Text>
          <TextInput
            style={sharedInputStyle}
            placeholder="z. B. 101"
            value={zimmerNumber}
            onChangeText={setzimmerNumber}
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Neuer Check-In:</Text>
          <TextInput
            style={sharedInputStyle}
            placeholder="YYYY-MM-DD"
            value={checkIn}
            onChangeText={setCheckIn}
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Neuer Check-Out:</Text>
          <TextInput
            style={sharedInputStyle}
            placeholder="YYYY-MM-DD"
            value={checkOut}
            onChangeText={setCheckOut}
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Gastname:</Text>
          <TextInput
            style={sharedInputStyle}
            placeholder="Vorname Nachname"
            value={guestName}
            onChangeText={setGuestName}
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Anzahl Personen:</Text>
          <TextInput
            style={sharedInputStyle}
            placeholder="z. B. 2"
            value={personCount}
            onChangeText={setPersonCount}
            keyboardType="numeric"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Status:</Text>
          <RadioGroup
            options={[
              { label: 'Belegt', value: 'belegt' },
              { label: 'Anzahlung', value: 'anzahlung' },
              { label: 'Anz. bez', value: 'anzahlung_bezahlt' },
            ]}
            selectedValue={status}
            onChange={setStatus}
          />
          <Text style={styles.label}>Anzahlung:</Text>
          <TextInput
            style={sharedInputStyle}
            placeholder="0"
            value={anzahlung}
            onChangeText={setAnzahlung}
            keyboardType="numeric"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Verpflegung:</Text>
          <RadioGroup
            options={[
              { label: 'Frühstück', value: 'Frühstück' },
              { label: 'Halbpension', value: 'Halbpension' },
            ]}
            selectedValue={verpflegung}
            onChange={setVerpflegung}
          />
          <Text style={styles.label}>Preis pro Person:</Text>
          <TextInput
            style={sharedInputStyle}
            placeholder="z. B. 50"
            value={preisProPerson}
            onChangeText={setPreisProPerson}
            keyboardType="numeric"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Hund:</Text>
          <RadioGroup
            options={[
              { label: 'Nein', value: 'nein' },
              { label: 'Ja', value: 'ja' },
            ]}
            selectedValue={hund}
            onChange={setHund}
          />
          <Text style={styles.label}>Zusatz Preis:</Text>
          <TextInput
            style={sharedInputStyle}
            placeholder="z. B. 10"
            value={zusatzPreis}
            onChangeText={setZusatzPreis}
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Tel.: / email:</Text>
          <TextInput
            style={sharedInputStyle}
            placeholder="Telefon oder Email"
            value={telEmail}
            onChangeText={setTelEmail}
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.label}>Notiz:</Text>
          <TextInput
            style={[sharedInputStyle, { height: 80 }]}
            placeholder="Notiz"
            value={notiz}
            onChangeText={setNotiz}
            multiline
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />
          <View style={styles.buttonRow}>
            <Button title="Aktualisieren" disabled={!isFormValid || isSubmitting} onPress={handleUpdate} />
            <Button title="Löschen" color="red" onPress={handleDelete} disabled={isSubmitting} />
          </View>
          <View style={styles.modalButtons}>
            <Button title="Schließen" onPress={onClose} disabled={isSubmitting} />
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
  radioGroup: { flexDirection: 'row', marginBottom: 12 },
  radioOption: { paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 4, marginRight: 8 },
  radioOptionSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  radioLabel: { fontSize: 16, color: 'black' },
  radioLabelSelected: { color: '#fff' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  modalButtons: { marginTop: 12, alignItems: 'center' },
});

export default memo(BookingEditModal);
