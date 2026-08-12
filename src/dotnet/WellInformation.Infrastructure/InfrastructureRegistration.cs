using Confluent.Kafka;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WellInformation.Application;

namespace WellInformation.Infrastructure;

public static class InfrastructureRegistration
{
    public static IServiceCollection AddWellInformationInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("WellInformationDB")
            ?? throw new InvalidOperationException("ConnectionStrings:WellInformationDB is required.");

        services.AddDbContextFactory<WellInformationDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped(serviceProvider =>
            serviceProvider.GetRequiredService<IDbContextFactory<WellInformationDbContext>>()
                .CreateDbContext());
        services.AddSingleton<IProducer<string, string>>(_ =>
        {
            var bootstrapServers = configuration["Kafka:BootstrapServers"]
                ?? throw new InvalidOperationException("Kafka:BootstrapServers is required.");
            return new ProducerBuilder<string, string>(new ProducerConfig
            {
                BootstrapServers = bootstrapServers,
                Acks = Acks.All,
                EnableIdempotence = true,
                MessageSendMaxRetries = 5
            }).Build();
        });
        services.AddScoped<IWellboreDesignService, KafkaWellboreDesignService>();
        return services;
    }
}
