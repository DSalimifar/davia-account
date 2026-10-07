using Microsoft.EntityFrameworkCore;
using DaviaAccount.Api.Models;

namespace DaviaAccount.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) {}

    public DbSet<Company> Companies => Set<Company>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<SalesInvoice> SalesInvoices => Set<SalesInvoice>();
    public DbSet<SalesInvoiceItem> SalesInvoiceItems => Set<SalesInvoiceItem>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Company>().HasKey(x => x.Id);
        b.Entity<User>().HasIndex(x => x.Username).IsUnique();
        b.Entity<Customer>().HasIndex(x => new { x.CompanyId, x.Code });
        b.Entity<Product>().HasIndex(x => new { x.CompanyId, x.Code });
        b.Entity<SalesInvoice>().HasIndex(x => new { x.CompanyId, x.InvoiceNumber });

        b.Entity<SalesInvoice>()
            .HasMany(x => x.Items)
            .WithOne()
            .HasForeignKey(x => x.InvoiceId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<Role>()
            .HasOne<Company>()
            .WithMany()
            .HasForeignKey(x => x.CompanyId);

        b.Entity<UserRole>()
            .HasKey(x => new { x.UserId, x.RoleId });
    }
}
