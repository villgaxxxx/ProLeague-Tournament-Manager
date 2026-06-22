import { useState } from 'react';

export default function RegisterTeam() {
    // تخزين بيانات الفورم
    const [formData, setFormData] = useState({
        name: '',
        captainName: '',
        phone: ''
    });

    // حالة التحميل ورسائل النجاح أو الخطأ
    const [status, setStatus] = useState({ loading: false, message: '', type: '' });

    // وظيفة للتعامل مع أي تغيير في الحقول
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // وظيفة الإرسال للـ Backend
    const handleSubmit = async (e) => {
        e.preventDefault(); // عشان نمنع الصفحة تعمل ريفريش
        setStatus({ loading: true, message: '', type: '' });

        try {
            // نبعت البيانات للـ .NET API (تأكد من البورت)
            const token = localStorage.getItem('adminToken');
            const response = await fetch('http://proleague-api.somee.com/api/teams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
        name: formData.name,
        captainName: formData.captainName,
        phone: formData.phone,
        points: 0, goalsFor: 0, goalsAgainst: 0
    })
});

            if (response.ok) {
                setStatus({ loading: false, message: 'تم تسجيل الفريق بنجاح! ⚽', type: 'success' });
                setFormData({ name: '', captainName: '', phone: '' }); // تفريغ الحقول بعد النجاح
            } else {
                setStatus({ loading: false, message: 'حصلت مشكلة أثناء التسجيل، جرب تاني.', type: 'error' });
            }
        } catch (error) {
            console.error('Error:', error);
            setStatus({ loading: false, message: 'مشكلة في الاتصال بالسيرفر.', type: 'error' });
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg mx-auto mt-10" dir="rtl">
            <h2 className="text-2xl font-black border-b pb-3 mb-5 text-blue-800">📝 تسجيل فريق جديد</h2>
            
            {status.message && (
                <div className={`p-3 mb-4 rounded font-bold text-center ${status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {status.message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-gray-700 font-bold mb-2">اسم الفريق</label>
                    <input 
                        type="text" 
                        name="name" 
                        value={formData.name} 
                        onChange={handleChange} 
                        required 
                        className="w-full p-3 border rounded focus:outline-none focus:border-blue-500 bg-gray-50"
                        placeholder="مثال: أبطال الملاعب"
                    />
                </div>

                <div>
                    <label className="block text-gray-700 font-bold mb-2">اسم الكابتن</label>
                    <input 
                        type="text" 
                        name="captainName" 
                        value={formData.captainName} 
                        onChange={handleChange} 
                        required 
                        className="w-full p-3 border rounded focus:outline-none focus:border-blue-500 bg-gray-50"
                        placeholder="الاسم الثلاثي"
                    />
                </div>

                <div>
                    <label className="block text-gray-700 font-bold mb-2">رقم الموبايل (للتواصل)</label>
                    <input 
                        type="tel" 
                        name="phone" 
                        value={formData.phone} 
                        onChange={handleChange} 
                        required 
                        className="w-full p-3 border rounded focus:outline-none focus:border-blue-500 bg-gray-50 text-right"
                        placeholder="01xxxxxxxxx"
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={status.loading}
                    className="w-full bg-yellow-400 text-blue-900 font-black py-3 rounded hover:bg-yellow-300 transition mt-4 disabled:opacity-50"
                >
                    {status.loading ? 'جاري التسجيل...' : 'تأكيد التسجيل'}
                </button>
            </form>
        </div>
    );
}