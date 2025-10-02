import { StyleSheet, View } from "react-native";
import { Card } from "../../../components/ui/card";
import { Text } from "../../../components/ui/text";

export default function Settings() {
    return (
        <View style={styles.container}>
            <Card className="bg-background-0 mb-4 p-0" style={{ overflow: "hidden", width: '90%' }}>
                <View style={styles.cardTitlebar}>
                    <Text size="md" className="text-typography-700 font-semibold" style={{ color: '#45A02A' }}>Über Servicefox Mobile</Text>
                </View>
                <View style={styles.cardBody}>
                    <Text className="text-typography-800">Version 0.0.1 </Text>
                </View>
            </Card>           
        </View>       
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        marginTop: 20,
        backgroundColor: "#F1F2F5",
    },
    cardTitlebar: {
    backgroundColor: '#f8f9fc',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#CCCED9',
    borderWidth: 1,
  },
  cardBody: {
    padding: 16,
    gap: 32,
    borderColor: '#CCCED9',
    borderWidth: 1,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderTopWidth: 0,
  },
});