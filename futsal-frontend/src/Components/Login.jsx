import { useState } from 'react';

export default function Login({ onLoginSuccess }) {
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const [status, setStatus] = useState({ loading: false, error: '' });

    const handleChange = (e) => {
        setCredentials({ ...credentials, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ loading: true, error: '' });

        try {
            const response = await fetch('http://proleague-api.somee.com/api/Auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials)
            });

            if (response.ok) {
                const data = await response.json();
                // السطر السحري: بنحفظ التوكن في ذاكرة المتصفح
                localStorage.setItem('adminToken', data.token);
                onLoginSuccess(); // بنبلغ الأبليكشن إن الدخول نجح
            } else {
                setStatus({ loading: false, error: 'بيانات الدخول غير صحيحة ❌' });
            }
        } catch (error) {
            setStatus({ loading: false, error: 'مشكلة في الاتصال بالسيرفر ⚠️' });
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm mx-auto mt-16" dir="rtl">
            <h2 className="text-2xl font-black text-center mb-6 text-gray-800">تسجيل دخول الإدارة 🔒</h2>
            
            {status.error && (
                <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm font-bold text-center">
                    {status.error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-gray-700 font-bold mb-2">اسم المستخدم</label>
                    <input 
                        type="text" 
                        name="username" 
                        onChange={handleChange} 
                        required 
                        className="w-full p-3 border rounded bg-gray-50 text-left focus:outline-none focus:border-blue-500"
                        dir="ltr"
                    />
                </div>
                <div>
                    <label className="block text-gray-700 font-bold mb-2">كلمة المرور</label>
                    <input 
                        type="password" 
                        name="password" 
                        onChange={handleChange} 
                        required 
                        className="w-full p-3 border rounded bg-gray-50 text-left focus:outline-none focus:border-blue-500"
                        dir="ltr"
                    />
                </div>
                <button 
                    type="submit" 
                    disabled={status.loading}
                    className="w-full bg-gray-800 text-white font-black py-3 rounded hover:bg-black transition mt-4"
                >
                    {status.loading ? 'جاري التحقق...' : 'دخول'}
                </button>
            </form>
        </div>
    );
}