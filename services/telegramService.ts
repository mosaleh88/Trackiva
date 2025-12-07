import { store } from './store';
import { Student, EPassDestination, User } from '../types';

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

// Helper to notify parent if configured
const notifyParent = async (student: Student, message: string, eventType: string) => {
    // Check if parent chat ID is configured
    if (!student.parentTelegramChatId) return;

    // Check if notification for this event type is enabled for the parent
    if (!student.parentNotificationPreferences || !student.parentNotificationPreferences[eventType]) return;

    // Use the main bot token for parent notifications
    const settings = store.getSettings();
    const token = settings.telegramBotToken; 

    if (token) {
        await sendTelegramMessage(message, token, student.parentTelegramChatId);
    }
};

export const sendUnauthorizedAlert = async (student: Student) => {
    const settings = store.getSettings();
    const eventType = 'UNAUTHORIZED';
    
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

    // 1. Send to School Admin/Security (if enabled globally)
    if (!settings.notificationRules || settings.notificationRules[eventType] !== false) {
        const creds = getCredentials(student, settings.telegramBotToken, settings.telegramChatId);
        await sendTelegramMessage(message, creds.token, creds.chatId);
    }

    // 2. Send to Parent (if enabled for this student)
    await notifyParent(student, message, eventType);
};

export const sendEarlyLeaveAlert = async (student: Student, reason: string, pickupBy: string, pickupId?: string) => {
    const settings = store.getSettings();
    const eventType = 'EARLY_LEAVE';
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

    // 1. Send to School Admin/Reception
    const creds = getCredentials(student, settings.earlyLeaveBotToken, settings.earlyLeaveChatId);
    await sendTelegramMessage(message, creds.token, creds.chatId);

    // 2. Send to Parent
    await notifyParent(student, message, eventType);
};

export const sendPassCreatedAlert = async (student: Student, destination: EPassDestination) => {
    const settings = store.getSettings();
    const eventType = destination.id;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const message = `
🎫 <b>E-PASS ISSUED</b> 🎫

<b>Student:</b> ${student.name_en} (${student.name_ar})
<b>Class:</b> ${student.grade} - ${student.section}
<b>Destination:</b> ${destination.label_en}
<b>Time:</b> ${timestamp}
${student.isWatchlisted ? '⚠️ <i>Targeted/Watchlist Student</i>' : ''}
    `;
    
    // 1. Send to School Admin (if enabled globally)
    if (settings.notificationRules && settings.notificationRules[eventType] === true) {
        // Use Default Security Channel for general pass alerts unless targeted
        const creds = getCredentials(student, settings.telegramBotToken, settings.telegramChatId);
        await sendTelegramMessage(message, creds.token, creds.chatId);
    }

    // 2. Send to Parent (if enabled for this student)
    await notifyParent(student, message, eventType);
};

// New Attendance Alert for Social Workers
export const sendAttendanceAlert = async (student: Student, totalDays: number, socialWorker: User) => {
    const settings = store.getSettings();
    
    // We need a global bot token specifically for attendance alerts if not reusing the main one
    // For this implementation, we added 'attendanceBotToken' to AppSettings
    const token = settings.attendanceBotToken || settings.telegramBotToken; 
    
    if (!token || !socialWorker.telegramChatId) return;

    const message = `
📅 <b>ATTENDANCE ALERT</b> 📅

<b>Student:</b> ${student.name_en} (${student.name_ar})
<b>Class:</b> ${student.grade} - ${student.section}
<b>Absence Count:</b> ${totalDays} Days

⚠️ <i>This student has reached a critical absence threshold.</i>
Please initiate the required intervention protocol.
    `;

    await sendTelegramMessage(message, token, socialWorker.telegramChatId);
};

export const sendEmergencyAlert = async (message?: string) => {
    const settings = store.getSettings();
    const token = settings.emergencyBotToken || settings.telegramBotToken;
    const chatId = settings.emergencyChatId;

    if (!token || !chatId) {
        console.warn("Emergency Alert credentials not configured.");
        return;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const alertMessage = `
🚨 <b>CRITICAL EMERGENCY ALERT</b> 🚨

<b>Time:</b> ${timestamp}
<b>Location:</b> School Clinic

<i>The Clinic Staff has triggered an Emergency Alert. Immediate assistance is required.</i>
${message ? `\n<b>Details:</b> ${message}` : ''}
    `;

    await sendTelegramMessage(alertMessage, token, chatId);
};