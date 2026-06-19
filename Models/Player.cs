using System.Text.Json.Serialization;

namespace FutsalApp.Models
{
    public class Player
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;

        // عداد أهداف اللاعب في البطولة
        public int Goals { get; set; } = 0;

        // المفتاح الأجنبي (Foreign Key) اللي بيربط اللاعب بفريقه
        public int TeamId { get; set; }

        // عشان الـ JSON ميتلخبطش ويدخل في لوب لا نهائية وإحنا بنبعت البيانات للـ React
        [JsonIgnore]
        public Team? Team { get; set; }

        public int YellowCards { get; set; } = 0;
        public int RedCards { get; set; } = 0;
        public bool IsSuspended { get; set; } = false; // هل اللاعب موقوف حالياً؟
        public int YellowCardsThisMatch { get; set; } = 0; // إنذارات الماتش الحالي فقط
        public bool SuspendedThisMatch { get; set; } = false; // هل أخد الطرد في الماتش الحالي؟
        public int BlueCards { get; set; } = 0; // الكروت الزرقاء (طرد أخلاقي)
        public int SuspendedMatchesLeft { get; set; } = 0; // باقي له كام ماتش إيقاف (1 للأحمر، 2 للأزرق)
    }
}