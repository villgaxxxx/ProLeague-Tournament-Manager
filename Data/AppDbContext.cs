using Microsoft.EntityFrameworkCore;
using FutsalApp.Models;

namespace FutsalApp.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // ربط كلاس الفريق بجدول Teams
        public DbSet<Team> Teams { get; set; }
        public DbSet<Match> Matches { get; set; }
        public DbSet<Player> Players { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<TournamentSetting> TournamentSettings { get; set; }
        // 👇 الدالة السحرية لحل مشكلة الـ SQL Server
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // منع الحذف التلقائي المتداخل (Cascade Paths) للفريق الأول
            modelBuilder.Entity<Match>()
                .HasOne(m => m.Team1)
                .WithMany()
                .HasForeignKey(m => m.Team1Id)
                .OnDelete(DeleteBehavior.NoAction);

            // منع الحذف التلقائي المتداخل للفريق الثاني
            modelBuilder.Entity<Match>()
                .HasOne(m => m.Team2)
                .WithMany()
                .HasForeignKey(m => m.Team2Id)
                .OnDelete(DeleteBehavior.NoAction);
        }
    }
}