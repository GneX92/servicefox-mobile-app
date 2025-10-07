import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            alert('Failed to get push token for push notification!');
            return;
        }

        const projectId = 
            Constants.expoConfig?.extra?.eas?.projectId ?? 
            Constants.easConfig?.projectId;

        if (!projectId) {
            console.warn('No EAS project ID found. Push notifications may not work as expected.');
        }

        try {
            const tokenData = (
                await Notifications.getExpoPushTokenAsync({
                    projectId,
                })
            ).data;
            return tokenData;
        } catch (error: unknown) {
            console.error('Error fetching push token:', error);
            return;
        }
    } else {
        alert('Must use physical device for Push Notifications');
    }
}