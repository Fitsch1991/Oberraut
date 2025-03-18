// src/components/Header.tsx
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const Header: React.FC = () => {
  return (
    <View style={styles.header}>
      {/* Linke Seite: leer, damit das zentrale Logo zentriert bleibt */}
      <View style={styles.sideContainer} />
      
      {/* Zentrales Logo */}
      <Image source={require('../../assets/logo.png')} style={styles.logo} />
      
      {/* Rechte Seite: LogoBetrieb, etwas größer */}
      <View style={styles.sideContainer}>
        <Image source={require('../../assets/LogoBetrieb.png')} style={styles.logoBetrieb} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 50, // Anpassen, damit beide Logos gut hineinpassen
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
  logo: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  logoBetrieb: {
    width: 100, // Etwas größer als das Hauptlogo
    height: 100,
    resizeMode: 'contain',
  },
});

export default Header;
