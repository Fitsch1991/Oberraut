import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';

interface HeaderProps {
  title?: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <View style={styles.header}>
      {/* Linke Seite: Hauptlogo */}
      <View style={styles.sideContainer}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
      </View>

      {/* Mittlere Seite: Titel (wird von der jeweiligen Seite übergeben) */}
      <View style={styles.centerContainer}>
        {title && <Text style={styles.title}>{title}</Text>}
      </View>

      {/* Rechte Seite: Betriebslogo */}
      <View style={styles.sideContainer}>
        <Image source={require('../../assets/LogoBetrieb.png')} style={styles.logoBetrieb} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingHorizontal: 10,
  },
  sideContainer: {
    flex: 1,
    alignItems: 'center',
  },
  centerContainer: {
    flex: 2,
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 40,
    resizeMode: 'contain',
  },
  logoBetrieb: {
    width: 100,
    height: 40,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default Header;
