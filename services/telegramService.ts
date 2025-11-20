
import { store } from './store';
import { Student, EPassDestination } from '../types';

// This service handles sending notifications to a Telegram channel/chat
// It reads configuration from the App Store (localStorage)

const sendTelegramMessage = async (message: string, token?: string, chatId?: string) => {
    if (!token || !chatId) {
        return; // Credentials not configured
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error("Telegram API Error:", error);
        }
    } catch (error) {
        console.error("Failed to send Telegram notification:", error);
    }
};

// Helper to determine which credentials to use
const getCredentials = (student: Student, defaultToken?: string, defaultChat?: string) => {
    const settings = store.getSettings();
    
    if (student.isWatchlisted && settings.watchlistBotToken && settings.watchlistChatId) {
        return { token: settings.watchlistBotToken, chatId: settings.watchlistChatId };
    }
    
    return { token: defaultToken, chatId: defaultChat };
};

export const sendUnauthorizedAlert = async (student: Student) => {
    const settings = store.getSettings();
    
    // Check if notification is enabled for UNAUTHORIZED
    if (settings.notificationRules && settings.notificationRules['UNAUTHORIZED'] === false) {
        return;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const message = `
🚨 <b>UNAUTHORIZED EXIT DETECTED</b> 🚨

<b>Student:</b> ${student.name_en} (${student.name_ar})
<b>ID:</b> ${student.studentNumber}
<b>Class:</b> ${student.grade} - ${student.section}
<b>Time:</b> ${timestamp}
${student.isWatchlisted ? '⚠️ <i>Targeted/Watchlist Student</i>' : ''}

<i>This student has left the classroom without permission.</i>
    `;

    const creds = getCredentials(student, settings.telegramBotToken, settings.telegramChatId);
    await sendTelegramMessage(message, creds.token, creds.chatId);
};

export const sendEarlyLeaveAlert = async (student: Student, reason: string, pickupBy: string, pickupId?: string) => {
    const settings = store.getSettings();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const message = `
⚠️ <b>EARLY LEAVE LOGGED</b> ⚠️

<b>Student:</b> ${student.name_en} (${student.name_ar})
<b>ID:</b> ${student.studentNumber}
<b>Class:</b> ${student.grade} - ${student.section}
<b>Time:</b> ${timestamp}
${student.isWatchlisted ? '⚠️ <i>Targeted/Watchlist Student</i>' : ''}

<b>Reason:</b> ${reason}
<b>Picked Up By:</b> ${pickupBy} ${pickupId ? `(ID: ${pickupId})` : ''}

<i>Attendance has been automatically updated.</i>
    `;

    // Use Early Leave credentials, or check if targeted overrides are needed
    // Logic: If targeted, send to targeted channel? Or Early Leave Channel?
    // Requirement: "when targeted student left early send notification to a deferent chat id"
    const creds = getCredentials(student, settings.earlyLeaveBotToken, settings.earlyLeaveChatId);
    await sendTelegramMessage(message, creds.token, creds.chatId);
};

export const sendPassCreatedAlert = async (student: Student, destination: EPassDestination) => {
    const settings = store.getSettings();
    
    // Check if notification is enabled for this specific destination ID
    if (settings.notificationRules && settings.notificationRules[destination.id] !== true) {
        return; 
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const message = `
🎫 <b>E-PASS ISSUED</b> 🎫

<b>Student:</b> ${student.name_en} (${student.name_ar})
<b>Class:</b> ${student.grade} - ${student.section}
<b>Destination:</b> ${destination.label_en}
<b>Time:</b> ${timestamp}
${student.isWatchlisted ? '⚠️ <i>Targeted/Watchlist Student</i>' : ''}
    `;
    
    // Use Default Security Channel for general pass alerts unless targeted
    const creds = getCredentials(student, settings.telegramBotToken, settings.telegramChatId);
    await sendTelegramMessage(message, creds.token, creds.chatId);
}
