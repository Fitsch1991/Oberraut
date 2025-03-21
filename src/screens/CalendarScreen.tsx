import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Button,
  Alert,
  Dimensions,
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
  status: string;
  verpflegung: string | null;
  hund: boolean | null;
  zusatz_preis: string;
  tel_email: string;
  notiz?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string; // Neu: Soft-Delete-Feld
};

type Gast = {
  id: number;
  vorname: string;
  nachname: string;
};

export type Data = {
  date: Date;
  dayNumber: string;
  monthYear: string;
};

export type DayCellData = {
  date: Date;
  dayNumber: string;
  monthYear: string;
};

// --- STYLES-KONSTANTEN ---
const DAY_WIDTH = 60;
const FIXED_WIDTH = 80;
const ROW_HEIGHT = 35;

// Bildschirmdimensionen
const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 400;

// --- HILFSFUNKTIONEN ---
function parseDate(dateStr: string): Date {
  return dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
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

function isIntervalAvailableForzimmer(
  zimmerId: number | null,
  start: Date,
  end: Date,
  bookings: Buchung[]
): boolean {
  if (!zimmerId) return false;
  if (start.getTime() === end.getTime()) return true;
  for (const booking of bookings) {
    if (booking.zimmer_id !== zimmerId) continue;
    const bookingStart = parseDate(booking.check_in);
    const bookingEnd = parseDate(booking.check_out);
    if (start < bookingEnd && end > bookingStart) {
      if (end.getTime() === bookingStart.getTime() || start.getTime() === bookingEnd.getTime()) {
        continue;
      }
      return false;
    }
  }
  return true;
}

function getBuchungForDay(dayData: DayCellData, zimmerId: number, buchungen: Buchung[]): Buchung | null {
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

const DayCell = React.memo<DayCellProps>(({ day, isSelected, existingBooking, onPress }) => {
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
});

// --- BookingBlockRow-Komponente ---
type BookingBlockRowProps = {
  zimmer: Zimmer;
  bookings: Buchung[];
  daysArray: DayCellData[];
  gaeste: Gast[];
  onPressBooking: (b: Buchung) => void;
  highlightedBookingId?: number | null;
};

const BookingBlockRow = React.memo((props: BookingBlockRowProps) => {
  const { zimmer, bookings, daysArray, gaeste, onPressBooking, highlightedBookingId } = props;
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
          <TouchableOpacity key={b.id} activeOpacity={0.8} onPress={() => onPressBooking(b)}>
            <View
              style={[
                styles.bookingBlock,
                { left: blockLeft, width: blockWidth, backgroundColor: blockColor },
                highlightedBookingId === b.id && { borderWidth: 3, borderColor: 'black' },
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

// --- Hauptkomponente ---
export default function CalendarScreen1({ buchungen, onRefresh }: { buchungen: Buchung[]; onRefresh: () => void; }) {
  const [localBuchungen, setLocalBuchungen] = useState<Buchung[]>([]);
  const [pastDays, setPastDays] = useState(10);
  const [futureMonths, setFutureMonths] = useState(6);
  const [zimmer, setZimmer] = useState<Zimmer[]>([]);
  const [gaeste, setGaeste] = useState<Gast[]>([]);
  const [selectedCheckIn, setSelectedCheckIn] = useState<DayCellData | null>(null);
  const [selectedCheckOut, setSelectedCheckOut] = useState<DayCellData | null>(null);
  const [selectedzimmerId, setSelectedzimmerId] = useState<number | null>(null);
  const [highlightedBookingId, setHighlightedBookingId] = useState<number | null>(null);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [isBookingModalVisible, setBookingModalVisible] = useState(false);
  const [isBookingEditModalVisible, setBookingEditModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null);
  const [guestInput, setGuestInput] = useState('');
  const [personCountInput, setPersonCountInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [displayedDate, setDisplayedDate] = useState(new Date());
  const scrollViewRef = useRef<ScrollView>(null);
  const lastRefreshTimeRef = useRef<number>(0);
  const monthAbbreviations = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const daysArray = useMemo(() => generateDaysArray(pastDays, futureMonths), [pastDays, futureMonths]);

  const fetchData = useCallback(async () => {
    try {
      const { data: zimmerData } = await supabase.from('zimmer').select('*');
      if (zimmerData) setZimmer(zimmerData as Zimmer[]);
      // Gäste laden: nur aktive Datensätze (falls auch hier ein Soft Delete genutzt wird)
      const { data: gaesteData } = await supabase.from('gaeste').select('*').is('deleted_at', null);
      if (gaesteData) setGaeste(gaesteData as Gast[]);
    } catch (error) {
      console.error('Fehler beim Laden von Zimmern/Gästen:', error);
    }
  }, []);

  // Refresh-Intervall auf 45 Sekunden
  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 45000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  // Lokale Buchungen: Hier filtern wir nur Buchungen, die nicht soft-deleted sind.
  useEffect(() => {
    setLocalBuchungen(buchungen.filter(b => !b.deleted_at));
  }, [buchungen]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastRefreshTimeRef.current > 45000) {
        onRefresh();
        lastRefreshTimeRef.current = now;
      }
    }, [onRefresh])
  );

  const handleScroll = useCallback((event: any) => {
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
  }, [daysArray, displayedDate]);

  const scrollToMonth = useCallback((targetDate: Date) => {
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
  }, [daysArray]);

  const handleMonthButtonPress = useCallback((monthIndex: number) => {
    const currentYear = displayedDate.getFullYear();
    const newDate = new Date(currentYear, monthIndex, 1);
    setDisplayedDate(newDate);
    scrollToMonth(newDate);
  }, [displayedDate, scrollToMonth]);

  const addBackwardExtension = useCallback(() => setPastDays(prev => prev + 90), []);
  const addForwardExtension = useCallback(() => setFutureMonths(prev => prev + 3), []);

  const handleDayPress = useCallback((day: DayCellData, zimmerId: number) => {
    if (!selectedCheckIn) {
      if (!isIntervalAvailableForzimmer(zimmerId, day.date, day.date, localBuchungen)) return;
      setSelectedzimmerId(zimmerId);
      setSelectedCheckIn(day);
      setSelectedCheckOut(day);
      return;
    }
    if (selectedzimmerId !== zimmerId) {
      if (!isIntervalAvailableForzimmer(zimmerId, day.date, day.date, localBuchungen)) return;
      setSelectedzimmerId(zimmerId);
      setSelectedCheckIn(day);
      setSelectedCheckOut(day);
      return;
    }
    if (isSameDay(day.date, selectedCheckIn.date)) {
      setSelectedCheckOut(day);
      return;
    }
    if (day.date >= selectedCheckIn.date) {
      const isAvailable = isIntervalAvailableForzimmer(zimmerId, selectedCheckIn.date, day.date, localBuchungen);
      const bookingAtDay = getBuchungForDay(day, zimmerId, localBuchungen);
      if (isAvailable || (bookingAtDay && isSameDay(day.date, parseDate(bookingAtDay.check_in)))) {
        setSelectedCheckOut(day);
        return;
      } else {
        Alert.alert("Das Intervall ist nicht verfügbar.");
        return;
      }
    }
    setSelectedCheckIn(day);
    setSelectedCheckOut(day);
  }, [selectedCheckIn, localBuchungen, selectedzimmerId]);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    const lowerQuery = searchQuery.toLowerCase();
    const matches = localBuchungen.filter((b) => {
      const guest = gaeste.find((g) => g.id === b.gast_id);
      if (!guest) return false;
      const fullName = `${guest.vorname} ${guest.nachname}`.toLowerCase();
      return fullName.includes(lowerQuery);
    }).map((b) => b.id);
    if (matches.length > 0) {
      const index = currentSearchIndex % matches.length;
      const bookingId = matches[index];
      setHighlightedBookingId(bookingId);
      setCurrentSearchIndex(currentSearchIndex + 1);
      const matchingBooking = localBuchungen.find(b => b.id === bookingId);
      if (matchingBooking) {
        const checkInDate = parseDate(matchingBooking.check_in);
        const dayIndex = findDayIndex(checkInDate, daysArray);
        if (dayIndex !== -1 && scrollViewRef.current) {
          const offsetX = FIXED_WIDTH + dayIndex * DAY_WIDTH;
          scrollViewRef.current.scrollTo({ x: offsetX, animated: true });
        }
      }
    } else {
      setHighlightedBookingId(null);
      setCurrentSearchIndex(0);
    }
  }, [searchQuery, localBuchungen, gaeste, daysArray, currentSearchIndex]);

  const openBookingModal = useCallback(() => {
    if (!selectedCheckIn || !selectedCheckOut || selectedzimmerId === null) {
      Alert.alert('Bitte Check‑In und Check‑Out auswählen.');
      return;
    }
    if (!isSameDay(selectedCheckIn.date, selectedCheckOut.date)) {
      setBookingModalVisible(true);
    } else {
      Alert.alert('Bitte wählen Sie unterschiedliche Tage für Check‑In und Check‑Out aus.');
    }
  }, [selectedCheckIn, selectedCheckOut, selectedzimmerId]);

  const handleBookingPress = useCallback((b: Buchung) => {
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
      zimmerNumber: zimmer.find((z) => z.id === b.zimmer_id)?.nummer || '',
    };
    setSelectedBooking(bookingData);
    setBookingEditModalVisible(true);
  }, [gaeste, zimmer]);

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
      if (!selectedCheckIn || !selectedCheckOut || selectedzimmerId === null) {
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
        .select('id, vorname, nachname')
        .eq('vorname', nameParts[0])
        .eq('nachname', nameParts[1]);
      if (existingGuest && existingGuest.length > 0) {
        guestId = existingGuest[0].id;
      } else {
        const { data: newGuest, error: guestError } = await supabase
          .from('gaeste')
          .insert([{ vorname: nameParts[0], nachname: nameParts[1] }])
          .select('*')
          .single();
        if (guestError || !newGuest) {
          Alert.alert('Fehler', 'Gast konnte nicht erstellt werden.');
          return;
        }
        guestId = newGuest.id;
      }
      const { data: newBooking, error: bookingError } = await supabase
        .from('buchungen')
        .insert([
          {
            zimmer_id: selectedzimmerId,
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
          }
        ])
        .select('*')
        .single();
      if (bookingError || !newBooking) {
        Alert.alert('Fehler', bookingError?.message || 'Buchung konnte nicht erstellt werden.');
        return;
      }
      Alert.alert('Erfolg', 'Buchung erstellt!');
      setSelectedzimmerId(null);
      setSelectedCheckIn(null);
      setSelectedCheckOut(null);
      setTimeout(() => {
        onRefresh();
        fetchData();
      }, 200);
    },
    [selectedCheckIn, selectedCheckOut, selectedzimmerId, onRefresh, fetchData]
  );

  const handleBookingUpdate = useCallback(
    async (updatedBooking: BookingData) => {
      await onRefresh();
      await fetchData();
      setBookingEditModalVisible(false);
      setSelectedBooking(null);
    },
    [onRefresh, fetchData]
  );

  const handleBookingDelete = useCallback(
    async (bookingId: number) => {
      // Bei Soft Delete wird deleted_at aktualisiert statt die Buchung zu löschen.
      const { error } = await supabase
        .from('buchungen')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', bookingId);
      if (error) {
        Alert.alert('Fehler', error.message);
      } else {
        Alert.alert('Erfolg', 'Buchung wurde soft-deleted!');
        await onRefresh();
        await fetchData();
        setBookingEditModalVisible(false);
        setSelectedBooking(null);
      }
    },
    [onRefresh, fetchData]
  );

  return (
    <View style={styles.container}>
      <Header title="Zimmer-Kalender" />

      <View style={styles.controlsContainer}>
        <Button title="-3 Monate" onPress={addBackwardExtension} />
        <Text style={styles.monthYearText}>
          {displayedDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
        </Text>
        <Button title="+3 Monate" onPress={addForwardExtension} />
      </View>

      <View style={styles.monthButtonsContainer}>
        {monthAbbreviations.map((abbr, index) => (
          <TouchableOpacity
            key={index}
            style={styles.monthButton}
            onPress={() => handleMonthButtonPress(index)}
          >
            <Text style={styles.monthButtonText}>
              {isSmallScreen ? abbr.substring(0, 2) : abbr}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tableContainer}>
        <View style={styles.fixedColumn}>
          <View style={[styles.headerCell, styles.leftHeaderCell]}>
            <Text style={styles.headerCellText}>Zimmer</Text>
          </View>
          {zimmer.map((zimmer) => (
            <View key={zimmer.id} style={styles.zimmerCell}>
              <Text style={styles.zimmerText}>Z. {zimmer.nummer}</Text>
            </View>
          ))}
        </View>

        <ScrollView
          horizontal
          style={styles.horizontalScroll}
          ref={scrollViewRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View>
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
                    <Text style={styles.headerDayNumber}>{day.dayNumber}</Text>
                  </View>
                );
              })}
            </View>

            {zimmer.map((zimmer) => (
              <View key={zimmer.id} style={{ position: 'relative', height: ROW_HEIGHT }}>
                <View style={styles.zimmerRow}>
                  {daysArray.map((day) => {
                    const isSelected =
                      selectedzimmerId === zimmer.id &&
                      ((selectedCheckIn && isSameDay(day.date, selectedCheckIn.date)) ||
                        (selectedCheckOut && isSameDay(day.date, selectedCheckOut.date)));
                    const existingBooking = getBuchungForDay(day, zimmer.id, localBuchungen);
                    return (
                      <DayCell
                        key={day.date.toISOString()}
                        day={day}
                        isSelected={isSelected}
                        existingBooking={existingBooking}
                        onPress={() => {
                          if (!selectedCheckIn) {
                            if (!existingBooking) handleDayPress(day, zimmer.id);
                          } else {
                            handleDayPress(day, zimmer.id);
                          }
                        }}
                      />
                    );
                  })}
                </View>
                <BookingBlockRow
                  zimmer={zimmer}
                  bookings={localBuchungen.filter((b) => b.zimmer_id === zimmer.id)}
                  daysArray={daysArray}
                  gaeste={gaeste}
                  onPressBooking={handleBookingPress}
                  highlightedBookingId={highlightedBookingId}
                />
              </View>
            ))}
          </View>
        </ScrollView>
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

      {selectedCheckIn && selectedCheckOut && !isSameDay(selectedCheckIn.date, selectedCheckOut.date) && (
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
        selectedzimmerId={selectedzimmerId || undefined}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 40,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  monthButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#eee',
  },
  monthButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: '#ddd',
  },
  monthButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tableContainer: {
    flex: 1,
    position: 'relative',
  },
  fixedColumn: {
    width: FIXED_WIDTH,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1,
  },
  horizontalScroll: {
    flex: 1,
    marginLeft: FIXED_WIDTH,
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
  headerSmallText: {
    fontSize: 10,
    color: '#555',
  },
  headerDayNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  headerCellText: {
    fontSize: 12,
    fontWeight: 'bold',
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
  zimmerRow: {
    flexDirection: 'row',
  },
  zimmerCell: {
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    height: ROW_HEIGHT,
    width: FIXED_WIDTH,
  },
  zimmerText: {
    fontSize: 12,
    fontWeight: 'bold',
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
