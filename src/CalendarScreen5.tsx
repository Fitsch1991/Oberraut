import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react';
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
import { supabase } from '../supabaseClient';
import BookingFormModal from '../components/BookingFormModal';
import BookingEditModal, { BookingData } from '../components/BookingEditModal';
import Header from '../components/Header';
import { useFocusEffect } from '@react-navigation/native';

// --- TYPEN ---
type Zimmer = {
  id: number;
  nummer: string;
  status: string;
  created_at: string;
};

export type Buchung = {
  id: number;
  zimmer_id: number;
  gast_id: number | null;
  check_in: string;
  check_out: string;
  anzahl_personen: number;
  preis_pro_person: number;
  anzahlung: number;
  status: string; // 'belegt' | 'anzahlung' | 'anzahlung_bezahlt' | 'booking' | ...
  verpflegung: string | null;
  hund: boolean | null;
  zusatz_preis: string;
  tel_email: string;
  notiz?: string;
  created_at: string;
  updated_at: string;
};

type Gast = {
  id: number;
  vorname: string;
  nachname: string;
  // Weitere Felder ...
};

export type Data = {
  date: Date;
  dayNumber: string;
  monthYear: string;
};

// --- STYLES-KONSTANTEN ---
const DAY_WIDTH = 60;
const FIXED_WIDTH = 80;
const ROW_HEIGHT = 35;

// --- HILFSFUNKTIONEN ---
function parseDate(dateStr: string): Date {
  return dateStr.includes('T')
    ? new Date(dateStr)
    : new Date(dateStr + 'T00:00:00');
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

function formatDayCellData(date: Date): DayCellData {
  const dayNumber = date.getDate().toString().padStart(2, '0');
  const monthYear = date
    .toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })
    .replace('.', '/');
  return { date: new Date(date), dayNumber, monthYear };
}

/*
  generateDaysArray:
  - Startdatum: aktueller Tag minus "pastDays" (initial 10 Tage)
  - Enddatum: aktueller Tag plus "futureMonths" (initial 6 Monate)
  Die Funktion generiert ein Array von DayCellData zwischen Start und End.
*/
function generateDaysArray(pastDays: number, futureMonths: number): DayCellData[] {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - pastDays);
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + futureMonths);

  const result: DayCellData[] = [];
  let current = new Date(startDate);
  while (current <= endDate) {
    result.push(formatDayCellData(current));
    current.setDate(current.getDate() + 1);
  }
  return result;
}

// Prüft, ob das Intervall [start, end] für einen bestimmten Raum verfügbar ist.
// Überschneidungen sind verboten, außer wenn das Ende exakt einem bestehenden Check‑in
// oder der Start exakt einem bestehenden Check‑out entspricht.
function isIntervalAvailableForRoom(
  roomId: number | null,
  start: Date,
  end: Date,
  bookings: Buchung[]
): boolean {
  if (!roomId) return false;
  if (start.getTime() === end.getTime()) return true;
  for (const booking of bookings) {
    if (booking.zimmer_id !== roomId) continue;
    const bookingStart = parseDate(booking.check_in);
    const bookingEnd = parseDate(booking.check_out);
    if (start < bookingEnd && end > bookingStart) {
      if (
        end.getTime() === bookingStart.getTime() ||
        start.getTime() === bookingEnd.getTime()
      ) {
        continue;
      }
      return false;
    }
  }
  return true;
}

// Liefert eine bestehende Buchung für einen Tag (Check‑out wird nicht blockiert)
function getBuchungForDay(
  dayData: DayCellData,
  zimmerId: number,
  buchungen: Buchung[]
): Buchung | null {
  return (
    buchungen.find((b) => {
      if (b.zimmer_id !== zimmerId) return false;
      const start = parseDate(b.check_in);
      const end = parseDate(b.check_out);
      return dayData.date >= start && dayData.date <= end;
    }) || null
  );
}

// --- DayCell-Komponente ---
type DayCellProps = {
  day: DayCellData;
  isSelected: boolean;
  existingBooking: Buchung | null;
  onPress: () => void;
};

const DayCell = React.memo<DayCellProps>(
  ({ day, isSelected, existingBooking, onPress }) => {
    return (
      <TouchableOpacity
        style={[
          styles.dayCell,
          { width: DAY_WIDTH, height: ROW_HEIGHT },
          existingBooking && { backgroundColor: 'transparent' },
          isSelected && styles.selectedDayCell,
        ]}
        onPress={onPress}
      >
        <Text style={styles.dayCellText}>{day.dayNumber}</Text>
      </TouchableOpacity>
    );
  }
);

// --- Komponente für dynamische Buchungsblöcke ---
type BookingBlockRowProps = {
  room: Zimmer;
  bookings: Buchung[];
  daysArray: DayCellData[];
  gaeste: Gast[];
  onPressBooking: (b: Buchung) => void;
};

const BookingBlockRow = React.memo((props: BookingBlockRowProps) => {
  const { room, bookings, daysArray, gaeste, onPressBooking } = props;

  return (
    <View style={styles.overlayContainer}>
      {bookings.map((b) => {
        const startDate = parseDate(b.check_in);
        const endDate = parseDate(b.check_out);
        const startIndex = findDayIndex(startDate, daysArray);
        const endIndex = findDayIndex(endDate, daysArray);

        if (startIndex < 0 || endIndex < 0) return null;

        let blockLeft = startIndex * DAY_WIDTH;
        let blockWidth = (endIndex - startIndex + 1) * DAY_WIDTH;

        if (startIndex === endIndex) {
          blockLeft += DAY_WIDTH / 2;
          blockWidth = DAY_WIDTH / 2;
        } else {
          blockLeft += DAY_WIDTH / 2;
          blockWidth -= DAY_WIDTH;
        }

        const guest = gaeste.find((g) => g.id === b.gast_id);
        const guestName = guest ? `${guest.vorname} ${guest.nachname}` : 'Unbekannt';

        let verpflegungAbbr = '';
        if (b.verpflegung === 'Frühstück') verpflegungAbbr = 'B&B';
        else if (b.verpflegung === 'Halbpension') verpflegungAbbr = 'HP';
        else if (b.verpflegung) verpflegungAbbr = b.verpflegung;

        const label = `${guestName} (${b.anzahl_personen}P) ${verpflegungAbbr}`;

        let blockColor = '#ccffcc';
        if (b.status === 'belegt') blockColor = '#ffcccc';
        else if (b.status === 'anzahlung') blockColor = '#ffffcc';
        else if (b.status === 'booking') blockColor = '#ccccff';

        return (
          <TouchableOpacity
            key={b.id}
            activeOpacity={0.8}
            onPress={() => onPressBooking(b)}
          >
            <View
              style={[
                styles.bookingBlock,
                {
                  left: blockLeft,
                  width: blockWidth,
                  backgroundColor: blockColor,
                },
              ]}
            >
              <Text style={styles.bookingBlockText} numberOfLines={2}>
                {label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// --- HAUPTKOMPONENTE ---
export default function CalendarScreen1({
  buchungen,
  onRefresh,
}: {
  buchungen: Buchung[];
  onRefresh: () => void;
}) {
  const [localBuchungen, setLocalBuchungen] = useState<Buchung[]>(buchungen);

  // Initial: 10 Tage in der Vergangenheit, 6 Monate in der Zukunft
  const [pastDays, setPastDays] = useState(10);
  const [futureMonths, setFutureMonths] = useState(6);

  const [zimmer, setZimmer] = useState<Zimmer[]>([]);
  const [gaeste, setGaeste] = useState<Gast[]>([]);

  const [selectedCheckIn, setSelectedCheckIn] = useState<DayCellData | null>(null);
  const [selectedCheckOut, setSelectedCheckOut] = useState<DayCellData | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  // Modals
  const [isBookingModalVisible, setBookingModalVisible] = useState(false);
  const [isBookingEditModalVisible, setBookingEditModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null);

  // Eingabe
  const [guestInput, setGuestInput] = useState('');
  const [personCountInput, setPersonCountInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [displayedDate, setDisplayedDate] = useState(new Date());
  const scrollViewRef = useRef<ScrollView>(null);
  const lastRefreshTimeRef = useRef<number>(0);

  const monthAbbreviations = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  // Erzeuge Days-Array basierend auf pastDays und futureMonths
  const daysArray = useMemo(() => {
    return generateDaysArray(pastDays, futureMonths);
  }, [pastDays, futureMonths]);

  // Zimmer / Gäste laden
  const fetchData = useCallback(async () => {
    try {
      const { data: zimmerData } = await supabase.from('zimmer').select('*');
      if (zimmerData) setZimmer(zimmerData as Zimmer[]);
      const { data: gaesteData } = await supabase.from('gaeste').select('*');
      if (gaesteData) setGaeste(gaesteData as Gast[]);
    } catch (error) {
      console.error('Fehler beim Laden von Zimmern/Gästen:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 120000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  // Buchungen aktualisieren
  useEffect(() => {
    setLocalBuchungen(buchungen);
  }, [buchungen]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastRefreshTimeRef.current > 30000) {
        onRefresh();
        lastRefreshTimeRef.current = now;
      }
    }, [onRefresh])
  );

  // Scroll -> Datum in Mitte (funktioniert weiterhin beim manuellen Scrollen)
  const handleScroll = useCallback(
    (event: any) => {
      const xOffset = event.nativeEvent.contentOffset.x;
      const visibleWidth = event.nativeEvent.layoutMeasurement.width;
      const centerX = xOffset + visibleWidth / 2;
      const index = Math.floor(centerX / DAY_WIDTH);
      if (index >= 0 && index < daysArray.length) {
        const newDate = daysArray[index].date;
        if (
          newDate.getMonth() !== displayedDate.getMonth() ||
          newDate.getFullYear() !== displayedDate.getFullYear()
        ) {
          setDisplayedDate(newDate);
        }
      }
    },
    [daysArray, displayedDate]
  );

  const scrollToMonth = useCallback(
    (targetDate: Date) => {
      if (daysArray.length === 0 || !scrollViewRef.current) return;
      const targetIndex = daysArray.findIndex(
        (d) =>
          d.date.getFullYear() === targetDate.getFullYear() &&
          d.date.getMonth() === targetDate.getMonth()
      );
      if (targetIndex !== -1) {
        const offsetX = FIXED_WIDTH + targetIndex * DAY_WIDTH;
        scrollViewRef.current.scrollTo({ x: offsetX, animated: true });
      }
    },
    [daysArray]
  );

  const handleMonthButtonPress = useCallback(
    (monthIndex: number) => {
      const currentYear = displayedDate.getFullYear();
      const newDate = new Date(currentYear, monthIndex, 1);
      setDisplayedDate(newDate);
      scrollToMonth(newDate);
    },
    [displayedDate, scrollToMonth]
  );

  // Erweiterungsfunktionen:
  // Für die Vergangenheit: Bei jedem Klick werden ca. 3 Monate (90 Tage) zusätzlich angezeigt.
  const addBackwardExtension = useCallback(() => setPastDays(prev => prev + 90), []);
  // Für die Zukunft: Bei jedem Klick werden 3 Monate hinzugefügt.
  const addForwardExtension = useCallback(() => setFutureMonths(prev => prev + 3), []);

  // Angepasste Logik beim Auswählen der Tageszellen:
  const handleDayPress = useCallback(
    (day: DayCellData, roomId: number) => {
      // Falls noch kein Check‑in gesetzt ist, müssen wir sicherstellen,
      // dass der Tag als Check‑in frei ist (d.h. keine Buchung mit Check‑in an diesem Tag).
      if (!selectedCheckIn) {
        if (!isIntervalAvailableForRoom(roomId, day.date, day.date, localBuchungen)) {
          return;
        }
        setSelectedRoomId(roomId);
        setSelectedCheckIn(day);
        setSelectedCheckOut(day);
        return;
      }
      // Falls ein anderer Raum ausgewählt wurde, setzen wir neu.
      if (selectedRoomId !== roomId) {
        if (!isIntervalAvailableForRoom(roomId, day.date, day.date, localBuchungen)) {
          return;
        }
        setSelectedRoomId(roomId);
        setSelectedCheckIn(day);
        setSelectedCheckOut(day);
        return;
      }
      // Wenn der geklickte Tag exakt gleich wie der bereits gewählte Check‑in ist,
      // interpretieren wir den Klick als Versuch, den Check‑out zu setzen.
      if (isSameDay(day.date, selectedCheckIn.date)) {
        setSelectedCheckOut(day);
        return;
      }
      // Wenn der geklickte Tag nach dem Check‑in liegt, prüfen wir das Intervall.
      if (day.date >= selectedCheckIn.date) {
  const isAvailable = isIntervalAvailableForRoom(roomId, selectedCheckIn.date, day.date, localBuchungen);
  const bookingAtDay = getBuchungForDay(day, roomId, localBuchungen);

  if (isAvailable || (bookingAtDay && isSameDay(day.date, parseDate(bookingAtDay.check_in)))) {
    setSelectedCheckOut(day);
    return;
  } else {
    Alert.alert("Das Intervall ist nicht verfügbar.");
    return;
  }
      }
      // Wenn ein Tag vor dem aktuellen Check‑in gewählt wird, setzen wir neu.
      setSelectedCheckIn(day);
      setSelectedCheckOut(day);
    },
    [selectedCheckIn, localBuchungen, selectedRoomId]
  );

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    const lowerQuery = searchQuery.toLowerCase();
    const matchingBooking = localBuchungen.find((b) => {
      const guest = gaeste.find((g) => g.id === b.gast_id);
      if (!guest) return false;
      const fullName = `${guest.vorname} ${guest.nachname}`.toLowerCase();
      return fullName.includes(lowerQuery);
    });
    if (matchingBooking) {
      const checkInDate = parseDate(matchingBooking.check_in);
      const index = findDayIndex(checkInDate, daysArray);
      if (index !== -1 && scrollViewRef.current) {
        const offsetX = FIXED_WIDTH + index * DAY_WIDTH;
        scrollViewRef.current.scrollTo({ x: offsetX, animated: true });
      }
    }
  }, [searchQuery, localBuchungen, gaeste, daysArray]);

  const openBookingModal = useCallback(() => {
    if (!selectedCheckIn || !selectedCheckOut || selectedRoomId === null) {
      Alert.alert('Bitte Check‑In und Check‑Out auswählen.');
      return;
    }
    setBookingModalVisible(true);
  }, [selectedCheckIn, selectedCheckOut, selectedRoomId]);

  const handleBookingPress = useCallback(
    (b: Buchung) => {
      const guest = gaeste.find((g) => g.id === b.gast_id);
      const bookingData: BookingData = {
        id: b.id,
        zimmer_id: b.zimmer_id,
        guestName: guest ? `${guest.vorname} ${guest.nachname}` : 'Unbekannt',
        personCount: b.anzahl_personen,
        checkIn: b.check_in,
        checkOut: b.check_out,
        status: b.status,
        anzahlung: b.anzahlung,
        verpflegung: b.verpflegung || '',
        preisProPerson: b.preis_pro_person,
        hund: b.hund || false,
        zusatz_preis: b.zusatz_preis,
        tel_email: b.tel_email,
        notiz: b.notiz || '',
        roomNumber: zimmer.find((z) => z.id === b.zimmer_id)?.nummer || '',
      };
      setSelectedBooking(bookingData);
      setBookingEditModalVisible(true);
    },
    [gaeste, zimmer]
  );

  const handleBookingSubmit = useCallback(
    async (data: {
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
    }) => {
      if (!selectedCheckIn || !selectedCheckOut || selectedRoomId === null) {
        Alert.alert('Fehler', 'Bitte Check‑In, Check‑Out und Zimmer auswählen.');
        return;
      }
      const checkInDate = selectedCheckIn.date.toISOString().split('T')[0];
      const checkOutDate = selectedCheckOut.date.toISOString().split('T')[0];

      const nameParts = data.guestName.trim().split(' ');
      if (nameParts.length < 2) {
        Alert.alert('Fehler', 'Bitte Vor‑ und Nachname eingeben.');
        return;
      }
      let guestId: number | null = null;
      const { data: existingGuest } = await supabase
        .from('gaeste')
        .select('id')
        .eq('vorname', nameParts[0])
        .eq('nachname', nameParts[1]);
      if (existingGuest && existingGuest.length > 0) {
        guestId = existingGuest[0].id;
      } else {
        const { data: newGuest } = await supabase
          .from('gaeste')
          .insert([{ vorname: nameParts[0], nachname: nameParts[1] }])
          .select('*')
          .single();
        if (!newGuest) {
          Alert.alert('Fehler', 'Gast konnte nicht erstellt werden.');
          return;
        }
        guestId = newGuest.id;
      }

      const { error } = await supabase.from('buchungen').insert([
        {
          zimmer_id: selectedRoomId,
          gast_id: guestId,
          check_in: checkInDate,
          check_out: checkOutDate,
          anzahl_personen: data.personCount,
          preis_pro_person: data.preisProPerson ?? 0,
          anzahlung: data.anzahlung,
          status: data.status,
          verpflegung: data.verpflegung,
          hund: data.hund,
          zusatz_preis: data.zusatzPreis,
          tel_email: data.tel_email,
          notiz: data.notiz,
        },
      ]);
      if (error) {
        Alert.alert('Fehler', error.message);
      } else {
        Alert.alert('Erfolg', 'Buchung erstellt!');
        setSelectedRoomId(null);
        setSelectedCheckIn(null);
        setSelectedCheckOut(null);
        await onRefresh();
        await fetchData(); // Gästeliste sofort aktualisieren
      }
    },
    [selectedCheckIn, selectedCheckOut, selectedRoomId, onRefresh, fetchData]
  );

  const handleBookingUpdate = useCallback(
    async (updatedBooking: BookingData) => {
      await onRefresh();
      await fetchData(); // Gästeliste auch nach Aktualisierungen neu laden
      setBookingEditModalVisible(false);
      setSelectedBooking(null);
    },
    [onRefresh, fetchData]
  );

  const handleBookingDelete = useCallback(
    async (bookingId: number) => {
      await onRefresh();
      await fetchData();
      setBookingEditModalVisible(false);
      setSelectedBooking(null);
    },
    [onRefresh, fetchData]
  );

  return (
    <View style={styles.container}>
      <Header />

  <Header title="Zimmer-Kalender" />

      {/* Obere Monats-/Jahresanzeige */}
      <View style={styles.monthYearContainer}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.monthYearText}>
            {displayedDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* Erweiterungsbuttons für Vergangenheit und Zukunft */}
      <View style={styles.extensionButtonsContainer}>
        <Button title="-3 Monate" onPress={addBackwardExtension} />
        <Button title="+3 Monate" onPress={addForwardExtension} />
      </View>

      <View style={styles.tableContainer}>
        {/* Fixe Spalte: Zimmer */}
        <View style={styles.fixedColumn}>
          <View style={[styles.headerCell, styles.leftHeaderCell]}>
            <Text style={styles.headerText}>Zimmer</Text>
          </View>
          {zimmer.map((room) => (
            <View key={room.id} style={styles.roomCell}>
              <Text style={styles.roomText}>Z. {room.nummer}</Text>
            </View>
          ))}
        </View>

        {/* Horizontal scrollbarer Bereich */}
        <ScrollView
          horizontal
          style={styles.horizontalScroll}
          ref={scrollViewRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View>
            {/* Tage-Header */}
            <View style={styles.headerRow}>
              {daysArray.map((day) => {
                const isToday = isSameDay(day.date, new Date());
                const weekday = day.date.toLocaleDateString('de-DE', { weekday: 'short' });
                const weekend = weekday.startsWith('Sa') || weekday.startsWith('So');
                return (
                  <View
                    key={day.date.toISOString()}
                    style={[
                      styles.headerCell,
                      { width: DAY_WIDTH },
                      isToday && styles.todayHeader,
                      weekend && styles.weekendHeader,
                    ]}
                  >
                    <Text style={styles.headerSmallText}>
                      {weekday} {day.monthYear}
                    </Text>
                    <Text style={styles.headerText}>{day.dayNumber}</Text>
                  </View>
                );
              })}
            </View>

            {/* Raumzeilen */}
            {zimmer.map((room) => (
              <View key={room.id} style={{ position: 'relative', height: ROW_HEIGHT }}>
                <View style={styles.roomRow}>
                  {daysArray.map((day) => {
                    const isSelected =
                      selectedRoomId === room.id &&
                      ((selectedCheckIn && isSameDay(day.date, selectedCheckIn.date)) ||
                        (selectedCheckOut && isSameDay(day.date, selectedCheckOut.date)));
                    const existingBooking = getBuchungForDay(day, room.id, localBuchungen);
                    return (
                      <DayCell
                        key={day.date.toISOString()}
                        day={day}
                        isSelected={isSelected}
                        existingBooking={existingBooking}
                        onPress={() => {
  const existingCheckInDate = existingBooking ? parseDate(existingBooking.check_in) : null;

  if (!selectedCheckIn) {
    // Kein Check-In gesetzt: Nur komplett freie Zellen auswählbar
    if (!existingBooking) {
      handleDayPress(day, room.id);
    }
  } else {
    // Check-In bereits gesetzt:
    // Check-Out darf frei sein ODER exakt am Check-In einer bestehenden Buchung liegen
    if (!existingBooking || isSameDay(day.date, existingCheckInDate)) {
      handleDayPress(day, room.id);
    }
  }
}}
                      />
                    );
                  })}
                </View>
                {/* Buchungsblöcke */}
                <BookingBlockRow
                  room={room}
                  bookings={localBuchungen.filter((b) => b.zimmer_id === room.id)}
                  daysArray={daysArray}
                  gaeste={gaeste}
                  onPressBooking={handleBookingPress}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.monthButtonsContainer}>
        {monthAbbreviations.map((abbr, index) => (
          <TouchableOpacity
            key={index}
            style={styles.monthButton}
            onPress={() => handleMonthButtonPress(index)}
          >
            <Text style={styles.monthButtonText}>{abbr}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Nach Gastname suchen..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Button title="Suchen" onPress={handleSearch} />
      </View>

      {selectedCheckIn && selectedCheckOut && (
        <TouchableOpacity style={styles.bookingButton} onPress={openBookingModal}>
          <Text style={styles.bookingButtonText}>Buchungsformular öffnen</Text>
        </TouchableOpacity>
      )}

      <BookingFormModal
        isVisible={isBookingModalVisible}
        checkIn={selectedCheckIn ? selectedCheckIn.date.toISOString().split('T')[0] : ''}
        checkOut={selectedCheckOut ? selectedCheckOut.date.toISOString().split('T')[0] : ''}
        onClose={() => setBookingModalVisible(false)}
        onSubmit={handleBookingSubmit}
        initialGuestName={guestInput}
        initialPersonCount={personCountInput ? parseInt(personCountInput) : 0}
        onRefresh={onRefresh}
        selectedRoomId={selectedRoomId || undefined}
      />

      {selectedBooking && (
        <BookingEditModal
          isVisible={isBookingEditModalVisible}
          booking={selectedBooking}
          onClose={() => {
            setBookingEditModalVisible(false);
            setSelectedBooking(null);
          }}
          onUpdate={handleBookingUpdate}
          onDelete={handleBookingDelete}
          onRefresh={onRefresh}
        />
      )}
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 16,
  },
  monthYearContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  monthYearText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  extensionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  tableContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  fixedColumn: {
    width: FIXED_WIDTH,
  },
  horizontalScroll: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  headerCell: {
    backgroundColor: '#eee',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    height: ROW_HEIGHT,
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  headerSmallText: {
    fontSize: 10,
    color: '#555',
  },
  leftHeaderCell: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  todayHeader: {
    backgroundColor: '#b3e6ff',
  },
  weekendHeader: {
    backgroundColor: '#cccccc',
  },
  roomRow: {
    flexDirection: 'row',
  },
  roomCell: {
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    height: ROW_HEIGHT,
    width: FIXED_WIDTH,
  },
  roomText: {
    fontSize: 12,
  },
  dayCell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDayCell: {
    backgroundColor: '#d0f0ff',
  },
  dayCellText: {
    fontSize: 10,
    color: '#333',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  bookingBlock: {
    position: 'absolute',
    top: 0,
    height: ROW_HEIGHT,
    borderWidth: 1,
    borderColor: '#99cc99',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  bookingBlockText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  monthButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 8,
  },
  monthButton: {
    backgroundColor: '#eee',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  monthButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  bookingButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    margin: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  bookingButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 4,
    marginRight: 8,
  },
});
