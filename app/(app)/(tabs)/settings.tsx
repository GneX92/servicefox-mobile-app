import { StyleSheet, Text, View } from "react-native";

export default function Settings() {
    return (
        <View style={styles.container}>
            <View style={styles.container}>
                <Text>Einstellungen</Text>
            </View>
            <View style={styles.container}>
                <Text>App Version 0.0.1</Text>
            </View>
        </View>       
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});