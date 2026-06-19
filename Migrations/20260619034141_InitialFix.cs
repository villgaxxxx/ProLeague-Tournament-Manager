using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FustalApp.Migrations
{
    /// <inheritdoc />
    public partial class InitialFix : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Message = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Teams",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    captain_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Points = table.Column<int>(type: "int", nullable: false),
                    goals_for = table.Column<int>(type: "int", nullable: false),
                    goals_against = table.Column<int>(type: "int", nullable: false),
                    Wins = table.Column<int>(type: "int", nullable: false),
                    Draws = table.Column<int>(type: "int", nullable: false),
                    Losses = table.Column<int>(type: "int", nullable: false),
                    GroupName = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Teams", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TournamentSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IsHomeAway = table.Column<bool>(type: "bit", nullable: false),
                    GroupSize = table.Column<int>(type: "int", nullable: false),
                    EnableBestThirds = table.Column<bool>(type: "bit", nullable: false),
                    IsGroupStageDrawn = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TournamentSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Matches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    team1_id = table.Column<int>(type: "int", nullable: false),
                    team2_id = table.Column<int>(type: "int", nullable: false),
                    match_date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    team1_score = table.Column<int>(type: "int", nullable: true),
                    team2_score = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsPlaying = table.Column<bool>(type: "bit", nullable: false),
                    IsFinished = table.Column<bool>(type: "bit", nullable: false),
                    IsPostponed = table.Column<bool>(type: "bit", nullable: false),
                    PostponeReason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MatchType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsPublished = table.Column<bool>(type: "bit", nullable: false),
                    Team1PenaltiesScore = table.Column<int>(type: "int", nullable: true),
                    Team2PenaltiesScore = table.Column<int>(type: "int", nullable: true),
                    MatchSummary = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Matches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Matches_Teams_team1_id",
                        column: x => x.team1_id,
                        principalTable: "Teams",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Matches_Teams_team2_id",
                        column: x => x.team2_id,
                        principalTable: "Teams",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Players",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Goals = table.Column<int>(type: "int", nullable: false),
                    TeamId = table.Column<int>(type: "int", nullable: false),
                    YellowCards = table.Column<int>(type: "int", nullable: false),
                    RedCards = table.Column<int>(type: "int", nullable: false),
                    IsSuspended = table.Column<bool>(type: "bit", nullable: false),
                    YellowCardsThisMatch = table.Column<int>(type: "int", nullable: false),
                    SuspendedThisMatch = table.Column<bool>(type: "bit", nullable: false),
                    BlueCards = table.Column<int>(type: "int", nullable: false),
                    SuspendedMatchesLeft = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Players", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Players_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Matches_team1_id",
                table: "Matches",
                column: "team1_id");

            migrationBuilder.CreateIndex(
                name: "IX_Matches_team2_id",
                table: "Matches",
                column: "team2_id");

            migrationBuilder.CreateIndex(
                name: "IX_Players_TeamId",
                table: "Players",
                column: "TeamId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Matches");

            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "Players");

            migrationBuilder.DropTable(
                name: "TournamentSettings");

            migrationBuilder.DropTable(
                name: "Teams");
        }
    }
}
