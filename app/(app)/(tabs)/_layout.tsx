import { Tabs } from "expo-router";
import { List, LogOut, Settings } from "lucide-react-native";
import { Pressable } from "react-native";
import { useAuth } from "../../../src/auth/AuthContext";

export default function TabLayout() {

    const { signOut } = useAuth();

    return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#e91e63', tabBarItemStyle: { paddingVertical: 6 }, headerTitleAlign: 'center' }}>
            {/* The first tab corresponds to app/(app)/(tabs)/index.tsx */}
            <Tabs.Screen name="index" options={{ 
                title: 'Serviceeinsätze',
                tabBarShowLabel: false,
                tabBarActiveTintColor: '#3B8724',
                tabBarInactiveTintColor: '#777777',
                tabBarIcon: ({ focused }) => (
                    <List size={28} color={focused ? '#3B8724' : '#777777'} />
                )
            }} />
            {/* The settings tab corresponds to app/(app)/(tabs)/settings.tsx */}
            <Tabs.Screen name="settings" options={{
                title: 'Einstellungen',
                tabBarShowLabel: false,
                tabBarActiveTintColor: '#3B8724',
                tabBarInactiveTintColor: '#777777',
                tabBarIcon: ({ focused }) => (
                    <Settings size={28} color={focused ? '#3B8724' : '#777777'} />
                )
            }} />
            <Tabs.Screen name="logout" options={{
                title: 'Abmelden',
                tabBarButton: () => (
                    <Pressable
                        accessibilityRole="button"
                        onPress={signOut}
                        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}
                        hitSlop={8}
                    >
                        <LogOut size={28} color="#d11a2a" />
                    </Pressable>
                ),
            }} />
        </Tabs>
    )
}

