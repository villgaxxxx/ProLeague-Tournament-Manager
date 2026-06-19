using System.ComponentModel.DataAnnotations.Schema; // السطر ده مهم جداً

namespace FutsalApp.Models
{
	public class Team
	{
		public int Id { get; set; }

		public string Name { get; set; } = string.Empty;

		[Column("captain_name")] // ربط مع عمود الداتا بيز
		public string CaptainName { get; set; } = string.Empty;

		public string Phone { get; set; } = string.Empty;

		public int Points { get; set; } = 0;

		[Column("goals_for")] // ربط مع عمود الداتا بيز
		public int GoalsFor { get; set; } = 0;

		[Column("goals_against")] // ربط مع عمود الداتا بيز
		public int GoalsAgainst { get; set; } = 0;

        // علاقة الفريق باللاعبين
        public ICollection<Player>? Players { get; set; }

        public int Wins { get; set; } = 0;
        public int Draws { get; set; } = 0;
        public int Losses { get; set; } = 0;
        public string? GroupName { get; set; } // اسم المجموعة

    }
}