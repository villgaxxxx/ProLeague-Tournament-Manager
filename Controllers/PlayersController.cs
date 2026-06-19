using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FutsalApp.Data;
using FutsalApp.Models;
using Microsoft.AspNetCore.Authorization;

namespace FutsalApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PlayersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PlayersController(AppDbContext context)
        {
            _context = context;
        }

        // 1. إضافة لاعب جديد لفريق (مقفولة للإدمن بس)
        [Authorize]
        [HttpPost]
        public async Task<ActionResult<Player>> AddPlayer(Player newPlayer)
        {
            // التأكد من وجود الفريق في قاعدة البيانات
            var teamExists = await _context.Teams.AnyAsync(t => t.Id == newPlayer.TeamId);
            if (!teamExists)
                return BadRequest(new { Message = "الفريق غير موجود." });

            // حساب عدد اللاعبين الحاليين في هذا الفريق
            var currentPlayersCount = await _context.Players.CountAsync(p => p.TeamId == newPlayer.TeamId);

            // التحقق من الحد الأقصى (8 لاعبين)
            if (currentPlayersCount >= 8)
            {
                return BadRequest(new { Message = "عفواً، هذا الفريق مكتمل بالفعل! الحد الأقصى هو 8 لاعبين فقط . 🛑" });
            }

            _context.Players.Add(newPlayer);
            await _context.SaveChangesAsync();

            return Ok(newPlayer);
        }

        // 2. جلب قائمة الهدافين (مفتوحة للجمهور)
        [HttpGet("topscorers")]
        public async Task<IActionResult> GetTopScorers()
        {
            var topScorers = await _context.Players
                .Where(p => p.Goals > 0) // بنجيب اللي سجلوا أهداف فقط
                .OrderByDescending(p => p.Goals) // ترتيب تنازلي حسب عدد الأهداف
                .Take(10) // عرض أفضل 10 هدافين فقط
                .Select(p => new
                {
                    PlayerId = p.Id,
                    PlayerName = p.Name,
                    Goals = p.Goals,
                    TeamName = p.Team!.Name // جلب اسم الفريق للعرض
                })
                .ToListAsync();

            return Ok(topScorers);
        }

        // 3. جلب تشكيلة فريق معين بالـ ID (مفتوحة للجمهور)
        [HttpGet("team/{teamId}")]
        public async Task<IActionResult> GetTeamPlayers(int teamId)
        {
            var players = await _context.Players
                .Where(p => p.TeamId == teamId)
                .Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.Goals
                })
                .ToListAsync();

            return Ok(players);
        }

        // 4. تزويد أهداف اللاعب (مقفولة للإدمن بس)
        [Authorize]
        [HttpPut("{id}/addgoal")]
        public async Task<IActionResult> AddGoal(int id)
        {
            var player = await _context.Players.FindAsync(id);
            if (player == null)
                return NotFound("اللاعب غير موجود.");

            player.Goals += 1; // تزويد رصيد الأهداف بـ 1
            await _context.SaveChangesAsync();

            return Ok(new { Message = "جوووووول! ⚽ تم إضافة الهدف بنجاح", PlayerName = player.Name, TotalGoals = player.Goals });
        }

        // 5. حذف لاعب (مقفولة للإدمن بس)
        [Authorize]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePlayer(int id)
        {
            var player = await _context.Players.FindAsync(id);
            if (player == null)
                return NotFound(new { Message = "اللاعب غير موجود." });

            _context.Players.Remove(player);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "تم حذف اللاعب بنجاح! 🗑️" });
        }
    }
}