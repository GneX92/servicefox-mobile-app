import { Tabs } from "expo-router";
import { List, LogOut, Settings } from "lucide-react-native";
import React, { useState } from 'react';
import { Pressable } from "react-native";
import { Button, ButtonText } from '../../../components/ui/button';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '../../../components/ui/modal';
import { Text } from '../../../components/ui/text';
import { useAuth } from "../../../src/auth/AuthContext";

export default function TabLayout() {
    const { signOut } = useAuth();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const openConfirm = () => setShowLogoutConfirm(true);
    const closeConfirm = () => setShowLogoutConfirm(false);
    const confirmLogout = async () => {
        closeConfirm();
        await signOut();
    };

    return (
        <>
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
                {/* The logout tab corresponds to app/(app)/(tabs)/logout.tsx */}
                <Tabs.Screen name="logout" options={{
                    title: 'Abmelden',
                    tabBarButton: () => (
                        <Pressable
                            accessibilityRole="button"
                            onPress={openConfirm}
                            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}
                            hitSlop={8}
                            accessibilityLabel="Abmelden"
                        >
                            <LogOut size={28} color="#d11a2a" />
                        </Pressable>
                    ),
                }} />
            </Tabs>
            <Modal isOpen={showLogoutConfirm} onClose={closeConfirm}>
                <ModalBackdrop />
                <ModalContent className="max-w-[340px] items-stretch">
                    <ModalHeader className="mb-2">
                        <Text className="text-lg font-semibold text-typography-950">Abmelden bestätigen</Text>
                    </ModalHeader>
                    <ModalBody className="mb-4">
                        <Text size="sm" className="text-typography-600">
                            Möchten Sie sich wirklich abmelden?
                        </Text>
                    </ModalBody>
                    <ModalFooter className="w-full flex-row gap-3">
                        <Button
                            variant="outline"
                            action="secondary"
                            size="sm"
                            onPress={closeConfirm}
                            className="flex-1"
                        >
                            <ButtonText>Abbrechen</ButtonText>
                        </Button>
                        <Button
                            action="negative"
                            size="sm"
                            onPress={confirmLogout}
                            className="flex-1"
                        >
                            <ButtonText style={{ color: "white" }}>Abmelden</ButtonText>
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}

