import { useState, useEffect } from 'react';

export default function AddPlayer() {
    const [teams, setTeams] = useState([]);
    const [formData, setFormData] = useState({ name: '', teamId: '' });
    const [status, setStatus] = useState({ loading: false, message: '', isError: false });

    // بنجيب الفرق من السيرفر أول ما الشاشة تفتح عشان نحطها في القائمة
    useEffect(() => {
        fetch('http://proleague-api.somee.com/api/teams')
            .then(res => res.json())
            .then(data => {
                // حماية عشان لو الداتا راجعة جوه $values
                const teamsData = Array.isArray(data) ? data : (data?.$values || []);
                setTeams(teamsData);
            })
            .catch(err => console.error("مشكلة في جلب الفرق:", err));
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ loading: true, message: '', isError: false });

        // بنستدعي التوكن بتاع الإدمن عشان السيرفر يرضى يدخل البيانات
        const token = localStorage.getItem('adminToken');

        try {
            const response = await fetch('http://proleague-api.somee.com/api/Players', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: formData.name,
                    teamId: parseInt(formData.teamId),
                    goals: 0 // اللاعب الجديد بيبدأ بـ 0 أهداف
                })
            });

            if (response.ok) {
                setStatus({ loading: false, message: 'تم تسجيل اللاعب في الفريق بنجاح! ⚽', isError: false });
                // بنفضي اسم اللاعب بس بنسيب الفريق زي ما هو عشان لو الإدمن عايز يضيف لاعب تاني لنفس الفريق
                setFormData({ ...formData, name: '' });
            } else {
                // هنا بقى السحر: بنقرا الرسالة اللي جاية من السيرفر (زي رسالة الحد الأقصى 8 لاعبين)
                const errorData = await response.json();
                const errorMessage = errorData.message || errorData.Message || 'حصلت مشكلة أثناء تسجيل اللاعب ❌';
                setStatus({ loading: false, message: errorMessage, isError: true });
            }
        } catch (error) {
            setStatus({ loading: false, message: 'مشكلة في الاتصال بالسيرفر ⚠️', isError: true });
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto mt-10" dir="rtl">
            <h2 className="text-2xl font-black text-center mb-6 text-gray-800">إضافة لاعب جديد 🏃‍♂️</h2>
            
            {status.message && (
                <div className={`p-3 rounded mb-4 text-sm font-bold text-center ${status.isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {status.message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-gray-700 font-bold mb-2">اسم اللاعب</label>
                    <input 
                        type="text" 
                        name="name" 
                        value={formData.name}
                        onChange={handleChange} 
                        required 
                        placeholder="مثال: محمد صلاح"
                        className="w-full p-3 border rounded bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-gray-700 font-bold mb-2">الفريق</label>
                    <select 
                        name="teamId" 
                        value={formData.teamId}
                        onChange={handleChange} 
                        required
                        className="w-full p-3 border rounded bg-gray-50 text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="" disabled className="text-gray-500 bg-white">-- اختر الفريق --</option>
                        {teams.map(team => (
                            <option key={team.id || team.Id} value={team.id || team.Id} className="bg-white text-gray-900 font-bold p-2">
                                {team.name || team.Name}
                            </option>
                        ))}
                    </select>
                </div>

                <button 
                    type="submit" 
                    disabled={status.loading || teams.length === 0}
                    className="w-full bg-blue-800 text-white font-black py-3 rounded hover:bg-blue-900 transition mt-4 disabled:bg-gray-400 shadow-md"
                >
                    {status.loading ? 'جاري الإضافة...' : 'إضافة اللاعب ➕'}
                </button>

                {teams.length === 0 && (
                    <p className="text-red-500 text-sm text-center font-bold mt-2">لازم تضيف فرق الأول قبل ما تسجل لاعبين!</p>
                )}
            </form>
        </div>
    );
}