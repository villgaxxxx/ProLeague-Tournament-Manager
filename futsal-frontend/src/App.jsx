import { useState, useEffect } from 'react';
import Standings from './Components/Standings';
import RegisterTeam from './Components/RegisterTeam';
import Matches from './Components/Matches';
import AddMatch from './Components/AddMatch';
import MatchResults from './Components/MatchResults';
import Login from './Components/Login';
import TopScorers from './Components/TopScorers';
import AddPlayer from './Components/AddPlayer';
import ManageTeam from './Components/ManageTeam';
import TeamsList from './Components/TeamsList';
import Notifications from './Components/Notifications';
import TournamentManager from './Components/TournamentManager';
import AdminSchedule from './Components/AdminSchedule';
import KnockoutBracket from './Components/KnockoutBracket';

function App() {
    const [activeTab, setActiveTab] = useState('standings');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    // دالة عشان لما تختار حاجة من القائمة، تغير التاب وتقفل القائمة لوحدها
    const handleTabClick = (tab) => {
        setActiveTab(tab);
        setIsSidebarOpen(false);
    };

    // التحقق من تسجيل الدخول
    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (token) setIsAdmin(true);
    }, []);

    // دالة تسجيل الخروج
    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        setIsAdmin(false);
        setActiveTab('standings'); 
        setIsSidebarOpen(false);
    };

    // دالة تصفير البطولة
    const handleResetTournament = async () => {
        // رسالة تحذيرية قوية للإدمن
        const confirmReset = window.confirm("⚠️ تحذير خطير: هل أنت متأكد أنك تريد مسح جميع بيانات البطولة (الفرق، اللاعبين، المباريات، والنتائج) للبدء من جديد؟\n\nلا يمكن التراجع عن هذه الخطوة!");
        
        if (!confirmReset) return; // لو داس Cancel هنوقف العملية

        const token = localStorage.getItem('adminToken');
        try {
            const response = await fetch('http://proleague-api.somee.com/api/Teams/reset', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                alert("✅ تم مسح جميع البيانات بنجاح. يمكنك الآن بدء بطولة جديدة!");
                window.location.reload(); // بنعمل ريفريش للصفحة عشان كل حاجة تفضى قدامه
            } else {
                alert("❌ حصلت مشكلة أثناء مسح البيانات.");
            }
        } catch (error) {
            alert("⚠️ مشكلة في الاتصال بالسيرفر.");
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen font-sans text-right" dir="rtl">
            
            {/* الهيدر العلوي وفيه زرار فتح القائمة */}
            <header className="bg-blue-800 text-white p-4 flex justify-between items-center shadow-md">
                <h1 className="text-2xl font-black">بطولة الخماسي ⚽</h1>
                <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className="text-white hover:text-yellow-300 focus:outline-none transition"
                >
                    {/* أيقونة القائمة (Hamburger) */}
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </header>

            {/* تعديل هنا: خلفية شفافة تماماً عشان الشاشة متسودش، بس لو دوست بره القائمة تقفل برضه */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-transparent z-40"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* القائمة الجانبية (Sidebar) */}
            <div className={`fixed top-0 right-0 h-full w-64 bg-blue-900 text-white z-50 transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {/* رأس القائمة وزرار الإغلاق */}
                <div className="p-4 flex justify-between items-center border-b border-blue-800">
                    <h2 className="text-xl font-bold">القائمة الرئيسية</h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-white hover:text-red-400 transition">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* محتوى القائمة والزراير */}
                <nav className="p-4 flex flex-col space-y-3 overflow-y-auto h-full">
                    <button onClick={() => handleTabClick('standings')} className={`text-right px-4 py-3 rounded font-bold transition ${activeTab === 'standings' ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'}`}>جدول الترتيب 🏆</button>
                    <button onClick={() => handleTabClick('knockouts')} className={`text-right px-4 py-3 rounded font-bold transition ${activeTab === 'knockouts' ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'}`}>الأدوار الإقصائية 🏆</button>
                    <button onClick={() => handleTabClick('teamsList')} className={`text-right px-4 py-3 rounded font-bold transition ${activeTab === 'teamsList' ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'}`}>الفرق المشاركة 🏃‍♂️</button>
                    <button onClick={() => handleTabClick('matches')} className={`text-right px-4 py-3 rounded font-bold transition ${activeTab === 'matches' ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'}`}>المباريات القادمة 📅</button>
                    <button onClick={() => handleTabClick('results')} className={`text-right px-4 py-3 rounded font-bold transition ${activeTab === 'results' ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'}`}>نتائج المباريات ⚽</button>
                    <button onClick={() => handleTabClick('topScorers')} className={`text-right px-4 py-3 rounded font-bold transition ${activeTab === 'topScorers' ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'}`}>الهدافين 🏅</button>
                    <button onClick={() => handleTabClick('notifications')} className={`text-right px-4 py-3 rounded font-bold transition ${activeTab === 'notifications' ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'}`}>📢 الإعلانات والإيقافات</button>

                    {/* زراير الإدمن */}
                    {isAdmin && (
                        <>
                            <div className="border-t border-blue-800 my-2"></div>
                            <h3 className="text-sm text-gray-400 mb-2 px-4">لوحة الإدارة</h3>
                            <button onClick={() => handleTabClick('register')} className={`text-right px-4 py-3 rounded font-bold transition ${activeTab === 'register' ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'}`}>تسجيل فريق 📝</button>
                            <button onClick={() => handleTabClick('addMatch')} className={`text-right px-4 py-3 rounded font-bold transition ${activeTab === 'addMatch' ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'}`}>جدولة مباراة ⚙️</button>
                            <button onClick={() => handleTabClick('addPlayer')} className={`text-right px-4 py-3 rounded font-bold transition ${activeTab === 'addPlayer' ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'}`}>إضافة لاعب 🏃‍♂️</button>
                            <button onClick={() => handleTabClick('manageTeam')} className={`text-right px-4 py-3 rounded font-bold transition ${activeTab === 'manageTeam' ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'}`}>إدارة الفرق 📋</button>
                            <button onClick={() => handleTabClick('tournament')} className={`text-right px-4 py-3 rounded font-bold transition ${activeTab === 'tournament' ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'}`}>إدارة البطولة والقرعة 🏆</button>
                            <button onClick={() => handleTabClick('adminSch')} className={`text-right px-4 py-3 rounded font-bold transition ${activeTab === 'tournament' ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'}`}>إدارة المباريات ⚽</button>
                            {/* زرار إعادة ضبط البطولة */}
                            <button 
                                onClick={handleResetTournament} 
                                className="text-right px-4 py-3 rounded font-black text-white bg-red-600 hover:bg-red-800 transition shadow-lg mt-4"
                            >
                                إعادة ضبط البطولة ⚠️
                            </button>
                        </>
                    )}

                    <div className="border-t border-blue-800 my-2"></div>
                    
                    {/* زرار تسجيل الدخول أو الخروج */}
                    {isAdmin ? (
                        <button onClick={handleLogout} className="text-right px-4 py-3 rounded font-bold text-red-400 hover:bg-blue-800 transition mt-auto">تسجيل خروج 🚪</button>
                    ) : (
                        <button onClick={() => handleTabClick('login')} className={`text-right px-4 py-3 rounded font-bold transition ${activeTab === 'login' ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'} mt-auto`}>الإدارة 🔒</button>
                    )}
                </nav>
            </div>

            {/* الجزء الخاص بعرض الشاشات */}
            <div className="mt-6 p-4 max-w-5xl mx-auto">
                {activeTab === 'standings' && <Standings />}
                {activeTab === 'matches' && <Matches />}
                {activeTab === 'addMatch' && <AddMatch />}
                {activeTab === 'results' && <MatchResults />}
                {activeTab === 'register' && <RegisterTeam />}
                {activeTab === 'login' && <Login onLoginSuccess={() => { setIsAdmin(true); setActiveTab('standings'); }} />}
                {activeTab === 'topScorers' && <TopScorers />}
                {activeTab === 'addPlayer' && <AddPlayer />}
                {activeTab === 'manageTeam' && <ManageTeam />}
                {activeTab === 'teamsList' && <TeamsList />}
                {activeTab === 'notifications' && <Notifications />}
                {activeTab === 'tournament' && <TournamentManager />}
                {activeTab === 'adminSch' && <AdminSchedule />}
                {activeTab === 'knockouts' && <KnockoutBracket />}
            </div>

        </div>
    );
}

export default App;