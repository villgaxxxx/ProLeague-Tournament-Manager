using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FutsalApp.Data;
using FutsalApp.Models;
using Microsoft.AspNetCore.Authorization;

namespace FutsalApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TeamsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TeamsController(AppDbContext context)
        {
            _context = context;
        }

        // جلب كل الفرق (لعمل جدول الترتيب) - مفتوحة للجمهور
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Team>>> GetTeams()
        {
            return await _context.Teams
                .Include(t => t.Players) // التعديل السحري هنا عشان يجيب لاعيبة كل فرقة
                .ToListAsync();
        }

        // تسجيل فريق جديد - مقفولة للإدمن فقط
        [Authorize]
        [HttpPost]
        public async Task<ActionResult<Team>> CreateTeam(Team newTeam)
        {
            _context.Teams.Add(newTeam);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetTeams), new { id = newTeam.Id }, newTeam);
        }

        [Authorize]
        [HttpGet("print-summary")]
        public async Task<IActionResult> GetTeamsPrintSummary()
        {
            var summary = await _context.Teams
                .Include(t => t.Players)
                .Select(t => new
                {
                    TeamName = t.Name,
                    CaptainName = t.CaptainName, // تأكد من اسم العمود عندك (مثلاً لو مخزن الكابتن في كلاس اللاعبين أو جدول الفرق)
                    CaptainPhone = t.Phone, // تأكد من اسم عمود الهاتف
                    GroupName = t.GroupName,
                    Players = t.Players.Select(p => p.Name).ToList()
                })
                .ToListAsync();

            return Ok(summary);
        }

        // مسح جميع بيانات البطولة للبدء من جديد (مقفولة للإدمن بس)
        [Authorize]
        [HttpDelete("reset")]
        public async Task<IActionResult> ResetTournament()
        {
            // 1. مسح جميع المباريات
            _context.Matches.RemoveRange(_context.Matches);

            // 2. مسح جميع اللاعبين
            _context.Players.RemoveRange(_context.Players);

            // 3. مسح جميع الفرق
            _context.Teams.RemoveRange(_context.Teams);

            // 4. مسح الإعلانات والإيقافات
            _context.Notifications.RemoveRange(_context.Notifications);
            // 5. 🔥 فتح زرار القرعة من جديد (عشان لما تضيف فرق جديدة يشتغل)
            var settings = await _context.TournamentSettings.FirstOrDefaultAsync();
            if (settings != null)
            {
                settings.IsGroupStageDrawn = false;
            }

            // حفظ التغييرات في قاعدة البيانات
            await _context.SaveChangesAsync();

            return Ok(new { Message = "تم تصفير البطولة ومسح جميع البيانات. 🗑️🔄" });
        }
    }
}