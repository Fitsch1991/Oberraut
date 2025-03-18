import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Button,
  Alert,
  Platform,
} from 'react-native';
import Modal from 'react-native-modal';
import { supabase } from '../supabaseClient';
import { useNavigation } from '@react-navigation/native';
import Header from '../components/Header';

export type DayCellData = {
  date: Date;
  dayNumber: string;
  monthYear: string;
};

type Zimmer = {
  id: number;
  nummer: string;
};

type Buchung = {
  id: number;
  zimmer_id: number;
  gast_id: number | null;
  check_in: string;
  check_out: string;
  anzahl_personen: number;
  status: string;
  verpflegung: string | null;
  zusatz_preis: string;
  tel_email: string;
};

type Gast = {
  id: number;
  vorname: string;
  nachname: string;
};

const DAY_WIDTH = 60;
const FIXED_WIDTH = 80;
const ROW_HEIGHT = 35;

function generateExtendedDaysArray(): DayCellData[] {
  const result: DayCellData[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 60);
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 18);
  let current = new Date(startDate);
  while (current <= endDate) {
    const dayNumber = current.getDate().toString().padStart(2, '0');
    const monthYear = current.toLocaleDateString('de-DE', {
      month: '2-digit',
      year: 'numeric',
    }).replace('.', '/');
    result.push({ date: new Date(current), dayNumber, monthYear });
    current.setDate(current.getDate() + 1);
  }
  return result;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function findDayIndex(date: Date, days: DayCellData[]): number {
  return days.findIndex((d) => isSameDay(d.date, date));
}

function getBuchungForDay(
  dayData: DayCellData,
  zimmerId: number,
  buchungen: Buchung[]
): Buchung | null {
  return (
    buchungen.find((b) => {
      if (b.zimmer_id !== zimmerId) return false;
      const start = new Date(b.check_in);
      const end = new Date(b.check_out);
      return dayData.date >= start && dayData.date <= end;
    }) || null
  );
}

const HomeScreen: React.FC = () => {
  const [daysArray, setDaysArray] = useState<DayCellData[]>([]);
  const [zimmer, setZimmer] = useState<Zimmer[]>([]);
  const [buchungen, setBuchungen] = useState<Buchung[]>([]);
  const [gaeste, setGaeste] = useState<Gast[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDetailBooking, setSelectedDetailBooking] = useState<Buchung | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const navigation = useNavigation();

  const fetchData = async () => {
    try {
      const { data: zimmerData } = await supabase.from('zimmer').select('*');
      if (zimmerData) setZimmer(zimmerData as Zimmer[]);
      const { data: buchungenData } = await supabase.from('buchungen').select('*');
      if (buchungenData) setBuchungen(buchungenData as Buchung[]);
      const { data: gaesteData } = await supabase.from('gaeste').select('*');
      if (gaesteData) setGaeste(gaesteData as Gast[]);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
    }
  };

  useEffect(() => {
    setDaysArray(generateExtendedDaysArray());
    fetchData();

    // Alle 2 Minuten Daten abrufen
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (daysArray.length > 0 && scrollViewRef.current) {
      const today = new Date();
      const indexOfToday = findDayIndex(today, daysArray);
      if (indexOfToday !== -1) {
        const offsetX = FIXED_WIDTH + indexOfToday * DAY_WIDTH;
        if (Platform.OS === 'ios') {
          setTimeout(() => {
            scrollViewRef.current?.scrollTo({ x: offsetX, animated: false });
          }, 100);
        } else {
          scrollViewRef.current?.scrollTo({ x: offsetX, animated: false });
        }
      }
    }
  }, [daysArray]);

  const formatDate = (date: Date): string => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  };

  const changeDate = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + offset);
    setSelectedDate(newDate);
  };

  const openBookingDetails = (b: Buchung) => {
    setSelectedDetailBooking(b);
    setDetailModalVisible(true);
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const lowerQuery = searchQuery.toLowerCase();
    const matchingBooking = buchungen.find((b) => {
      const guest = gaeste.find((g) => g.id === b.gast_id);
      if (!guest) return false;
      const fullName = (guest.vorname + ' ' + guest.nachname).toLowerCase();
      return fullName.includes(lowerQuery);
    });
    if (matchingBooking) {
      const checkInDate = new Date(matchingBooking.check_in);
      const index = findDayIndex(checkInDate, daysArray);
      if (index !== -1 && scrollViewRef.current) {
        const offsetX = FIXED_WIDTH + index * DAY_WIDTH;
        scrollViewRef.current.scrollTo({ x: offsetX, animated: true });
      }
    }
  };

  const goToCalendar = () => {
    navigation.navigate('Calendarscreen');
  };
  const goToAnzahlungen = () => {
    navigation.navigate('AnzahlungenScreen');
  };
  const goToSettings = () => {
    navigation.navigate('EinstellungenScreen');
  };

  return (
    <ScrollView style={styles.container}>
      <Header />
      <Text style={styles.title}>Tagesübersicht</Text>
      <View style={styles.dateSelector}>
        <Button title="‹" onPress={() => changeDate(-1)} />
        <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
        <Button title="›" onPress={() => changeDate(1)} />
      </View>
      <View style={styles.navigationButtons}>
        <Button title="Zum Kalender" onPress={goToCalendar} />
        <Button title="Anzahlungen" onPress={goToAnzahlungen} />
        <Button title="Einstellungen" onPress={goToSettings} />
      </View>
      <View style={styles.roomList}>
        {zimmer.map((room) => (
          <View key={room.id} style={styles.roomCard}>
            <Text style={styles.roomTitle}>Zimmer {room.nummer}</Text>
            {renderRoomStatus(room, selectedDate, buchungen, gaeste)}
          </View>
        ))}
      </View>
      <View style={styles.summary}>
        <View style={styles.summaryBorder}>
          <Text style={styles.summaryText}>
            Frühstück (B&B):{' '}
            {buchungen
              .filter(
                (b) =>
                 (b.verpflegung === 'Frühstück' || b.verpflegung === 'Halbpension') &&
                  new Date(b.check_in) <= selectedDate &&
                  new Date(b.check_out) >= selectedDate
              )
              .reduce((sum, b) => sum + b.anzahl_personen, 0)}{' '}
            P.
          </Text>
        </View>
        <View style={styles.summaryBorder}>
          <Text style={styles.summaryText}>
            Halbpension (HP):{' '}
            {buchungen
              .filter(
                (b) =>
                  b.verpflegung === 'Halbpension' &&
                  new Date(b.check_in) <= selectedDate &&
                  new Date(b.check_out) >= selectedDate
              )
              .reduce((sum, b) => sum + b.anzahl_personen, 0)}{' '}
            P.
          </Text>
        </View>
        <View style={styles.summaryBorder}>
          <Text style={styles.summaryText}>
            Check-Ins:{' '}
            {buchungen
              .filter((b) => isSameDay(new Date(b.check_in), selectedDate))
              .reduce((sum, b) => sum + b.anzahl_personen, 0)}{' '}
            P.
          </Text>
          {buchungen
            .filter((b) => isSameDay(new Date(b.check_in), selectedDate))
            .map((b, idx) => {
              const guest = gaeste.find((g) => g.id === b.gast_id);
              const roomNum = zimmer.find((z) => z.id === b.zimmer_id)?.nummer || '';
              return (
                <TouchableOpacity key={`in-${idx}`} onPress={() => openBookingDetails(b)}>
                  <Text style={styles.guestName}>
                    Zimmer {roomNum} - {guest ? `${guest.vorname} ${guest.nachname}` : 'Unbekannt'}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </View>
        <View style={styles.summaryBorder}>
          <Text style={styles.summaryText}>
            Check-Outs:{' '}
            {buchungen
              .filter((b) => isSameDay(new Date(b.check_out), selectedDate))
              .reduce((sum, b) => sum + b.anzahl_personen, 0)}{' '}
            P.
          </Text>
          {buchungen
            .filter((b) => isSameDay(new Date(b.check_out), selectedDate))
            .map((b, idx) => {
              const guest = gaeste.find((g) => g.id === b.gast_id);
              const roomNum = zimmer.find((z) => z.id === b.zimmer_id)?.nummer || '';
              return (
                <TouchableOpacity key={`out-${idx}`} onPress={() => openBookingDetails(b)}>
                  <Text style={styles.guestName}>
                    Zimmer {roomNum} - {guest ? `${guest.vorname} ${guest.nachname}` : 'Unbekannt'}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </View>
        <View style={styles.summaryBorder}>
          <Text style={styles.summaryText}>Anwesende Gäste:</Text>
          {buchungen
            .filter(
              (b) =>
                selectedDate > new Date(b.check_in) &&
                selectedDate < new Date(b.check_out)
            )
            .map((b, idx) => {
              const guest = gaeste.find((g) => g.id === b.gast_id);
              const roomNum = zimmer.find((z) => z.id === b.zimmer_id)?.nummer || '';
              return (
                <TouchableOpacity key={`active-${idx}`} onPress={() => openBookingDetails(b)}>
                  <Text style={styles.guestName}>
                    Zimmer {roomNum} - {guest ? `${guest.vorname} ${guest.nachname}` : 'Unbekannt'}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </View>
      </View>
      {selectedDetailBooking && (
        <Modal
          isVisible={detailModalVisible}
          onBackdropPress={() => setDetailModalVisible(false)}
          useNativeDriver={false}
          style={styles.customModalContainer}
        >
          <View style={styles.customModalOverlay}>
            <View style={styles.customModalContent}>
              <Text style={styles.modalTitle}>Buchungsdetails</Text>
              <Text>
                Zimmer:{' '}
                {zimmer.find((z) => z.id === selectedDetailBooking.zimmer_id)?.nummer}
              </Text>
              <Text>Check-In: {selectedDetailBooking.check_in}</Text>
              <Text>Check-Out: {selectedDetailBooking.check_out}</Text>
              <Text>
                Gast:{' '}
                {(() => {
                  const guest = gaeste.find((g) => g.id === selectedDetailBooking.gast_id);
                  return guest ? `${guest.vorname} ${guest.nachname}` : 'Unbekannt';
                })()}
              </Text>
              <Text>Personen: {selectedDetailBooking.anzahl_personen}</Text>
              <Text>Status: {selectedDetailBooking.status}</Text>
              <Text>
                Verpflegung: {selectedDetailBooking.verpflegung || '-'}
              </Text>
              <Text>Anzahlung: {selectedDetailBooking.anzahlung}</Text>
              <Text>
                Preis pro Person: {selectedDetailBooking.preis_pro_person}
              </Text>
              <Text>Zusatz Preis: {selectedDetailBooking.zusatz_preis}</Text>
              <Text>Tel.: / email: {selectedDetailBooking.tel_email}</Text>
              <Text>Notiz: {selectedDetailBooking.notiz || '-'}</Text>
              <Button title="Schließen" onPress={() => setDetailModalVisible(false)} />
            </View>
          </View>
        </Modal>
      )}
      <View style={styles.navFooter}>
        <Button title="Zum Kalender" onPress={goToCalendar} />
        <Button title="Anzahlungen" onPress={goToAnzahlungen} />
        <Button title="Einstellungen" onPress={goToSettings} />
      </View>
    </ScrollView>
  );
};

function renderRoomStatus(
  room: Zimmer,
  selectedDate: Date,
  buchungen: Buchung[],
  gaeste: Gast[]
) {
  const roomBookings = buchungen.filter((b) => b.zimmer_id === room.id);
  const currentBookings = roomBookings.filter((b) => {
    const checkIn = new Date(b.check_in);
    const checkOut = new Date(b.check_out);
    return (
      isSameDay(selectedDate, checkIn) ||
      isSameDay(selectedDate, checkOut) ||
      (selectedDate > checkIn && selectedDate < checkOut)
    );
  });

  if (currentBookings.length === 0) {
    return (
      <View style={[styles.statusBar, { backgroundColor: "#d3d3d3" }]}>
        <Text style={styles.statusBarText}>Frei</Text>
      </View>
    );
  }

  return (
    <View style={styles.statusBarsContainer}>
      {currentBookings.map((b) => {
        const checkInDate = new Date(b.check_in);
        const checkOutDate = new Date(b.check_out);
        const guest = gaeste.find((g) => g.id === b.gast_id);
        const guestLastName = guest ? guest.nachname : 'Unbekannt';
        let verpflegungAbbr = '';
        if (b.verpflegung) {
          verpflegungAbbr =
            b.verpflegung === 'Frühstück'
              ? 'B&B'
              : b.verpflegung === 'Halbpension'
              ? 'HP'
              : b.verpflegung;
        }
        let statusLabel = "";
        let backgroundColor = "";
        if (isSameDay(checkInDate, checkOutDate)) {
          statusLabel = `Check-in/Check-out: ${guestLastName} (${b.anzahl_personen} P.) [${verpflegungAbbr}]`;
          backgroundColor = "#ADD8E6";
        } else if (isSameDay(selectedDate, checkInDate)) {
          statusLabel = `Check-in: ${guestLastName} (${b.anzahl_personen} P.) [${verpflegungAbbr}]`;
          backgroundColor = "#ADD8E6";
        } else if (isSameDay(selectedDate, checkOutDate)) {
          statusLabel = `Check-out: ${guestLastName} (${b.anzahl_personen} P.) [${verpflegungAbbr}]`;
          backgroundColor = "#FFDAB9";
        } else {
          statusLabel = `belegt: ${guestLastName} (${b.anzahl_personen} P.) [${verpflegungAbbr}]`;
          backgroundColor = "#90EE90";
        }
        return (
          <View key={b.id} style={[styles.statusBar, { backgroundColor }]}>
            <Text style={styles.statusBarText}>{statusLabel}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  roomList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  roomCard: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    padding: 8,
    marginBottom: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  roomTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
  },
  statusBar: {
    padding: 4,
    borderRadius: 4,
    marginVertical: 2,
  },
  statusBarText: {
    fontSize: 14,
    color: '#000',
  },
  statusBarsContainer: {
    flexDirection: 'column',
  },
  guestName: {
    color: 'blue',
    textDecorationLine: 'underline',
    marginVertical: 2,
  },
  summary: {
    marginVertical: 16,
  },
  summaryBorder: {
    borderTopWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 8,
  },
  summaryText: {
    fontSize: 16,
  },
  customModalContainer: {
    margin: 0,
    justifyContent: 'center',
  },
  customModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  customModalContent: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    width: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  navFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
});

export { isSameDay, findDayIndex };
export default HomeScreen;

