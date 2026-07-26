using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.MediaPreview;

internal static class FrontendRegistration
{
    internal static bool TryRegisterConfigured(ILogger logger)
    {
        PluginConfiguration configuration = PluginConfigurationNormalizer.Normalize(Plugin.Instance?.Configuration);

        switch (configuration.FrontendInjectionMethod)
        {
            case FrontendInjectionMethods.FileTransformation:
                JavaScriptInjectorRegistrar.TrySetEnabled(logger, false);
                return FileTransformationRegistrar.TryRegister(logger);

            case FrontendInjectionMethods.JavaScriptInjector:
                return JavaScriptInjectorRegistrar.TryRegister(logger);

            default:
                if (FileTransformationRegistrar.TryRegister(logger))
                {
                    JavaScriptInjectorRegistrar.TrySetEnabled(logger, false);
                    return true;
                }

                return JavaScriptInjectorRegistrar.TryRegister(logger);
        }
    }
}
