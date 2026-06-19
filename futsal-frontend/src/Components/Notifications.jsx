import { useState, useEffect } from 'react';

export default function Notifications() {
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        fetch('https://proleague-api.somee.com/api/Notifications')
            .then(res => res.json())
            .then(data => setNotifications(data))
            .catch(err => console.error(err));
    }, []);

    return (
        <div className="max-w-3xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-lg" dir="rtl">
            <h2 className="text-3xl font-black text-center mb-6 text-red-700">📢 قرارات وإيقافات البطولة</h2>
            
            {notifications.length === 0 ? (
                <p className="text-center text-gray-500 font-bold">لا توجد إيقافات أو قرارات مسجلة حتى الآن.</p>
            ) : (
                <div className="space-y-4">
                    {notifications.map(note => (
                        <div key={note.id} className="bg-red-50 border-r-4 border-red-600 p-4 rounded shadow-sm flex flex-col">
                            <span className="font-bold text-gray-900 text-lg">{note.message || note.Message}</span>
                            <span className="text-xs text-gray-500 mt-2 font-bold">
                                📅 {new Date(note.createdAt || note.CreatedAt).toLocaleString('ar-EG')}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}