import { Logger } from 'botpress/sdk'
import { BotpressAPIProvider } from 'core/app/api'
import { Botpress } from 'core/app/botpress'
import { HTTPServer } from 'core/app/server'
import { ConfigProvider } from 'core/config'
import { EventCollector } from 'core/events'
import { LoggerDbPersister, LoggerFilePersister, LoggerProvider, PersistedConsoleLogger } from 'core/logger'
import { MigrationService } from 'core/migration'
import { ModuleLoader } from 'core/modules'
import { TelemetryContainerModules, AnalyticsService } from 'core/telemetry'
import { LocalActionServer } from 'core/user-code'
import { DataRetentionJanitor, DataRetentionService, WorkspaceService } from 'core/users'
import { Container, injectable } from 'inversify'

import { TYPES } from '../types'
import { DatabaseContainerModules } from './database.inversify'
import { RepositoriesContainerModules } from './repositories.inversify'
import { ServicesContainerModules } from './services.inversify'
import { applyDisposeOnExit, applyInitializeFromConfig } from './utils'

// START PATCH: Dummy Licensing Service
@injectable()
class DummyLicensingService {
  installProtection() { }
  async refreshLicenseKey(): Promise<boolean> {
    return true
  }
  async replaceLicenseKey(licenseKey: string): Promise<boolean> {
    return true
  }
  async getLicenseStatus(): Promise<any> {
    return { status: 'licensed', breachReasons: [] }
  }
  async getLicenseInfo(licenseKey?: string): Promise<any> {
    return {
      label: 'Community Unlocked',
      fingerprintType: 'machine_v1',
      fingerprint: 'dummy',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      offline: true,
      paidUntil: new Date(),
      versions: 'v12',
      support: 'standard',
      auditToken: 'dummy',
      limits: [],
      manualRefresh: false
    }
  }
  async getLicenseKey(): Promise<string> {
    return 'dummy-key'
  }
  async getFingerprint(fingerprintType: string): Promise<string> {
    return 'dummy-fingerprint'
  }
  async auditLicensing(auditToken: string): Promise<any | undefined> {
    return { superAdminsCount: 9999, collaboratorsCount: 9999 }
  }
}
// END PATCH

// START PATCH: Dummy AuthStrategies
@injectable()
class DummyAuthStrategies {
  private strategies: any[] = []
  public registerStrategy(strategy: any): void { }
  public getStrategies(): any[] {
    return this.strategies
  }
  public setup(): void { }
}
// END PATCH

// START PATCH: Dummy NLU Process
@injectable()
class DummyNluProcess {
  public async start(): Promise<void> { }
  public async stop(): Promise<void> { }
  public isAlive(): boolean {
    return true
  }
  public get = (path: string) => async () => ({})
  public post = (path: string) => async (body: any) => ({})
}
// END PATCH

// FIX: Symbol NluServer
const NluServer = Symbol('NluServer')

const container = new Container({ autoBindInjectable: true })

// Logger binding
container.bind<string>(TYPES.Logger_Name).toDynamicValue(ctx => {
  const targetName = ctx.currentRequest.parentRequest!.target.name
  const byProvider = ctx.plan.rootRequest.target.metadata.find(x => x.key === 'name')
  let loggerName = (targetName && targetName.value()) || (byProvider && byProvider.value)
  if (!loggerName) {
    const endclass = ctx.currentRequest.parentRequest && ctx.currentRequest.parentRequest.parentRequest
    if (endclass) {
      loggerName =
        endclass!.serviceIdentifier && endclass!.serviceIdentifier.toString().replace(/^Symbol\((.+)\)$/, '$1')
    }
  }
  return loggerName || ''
})

container.bind<Logger>(TYPES.Logger).to(PersistedConsoleLogger)
container.bind<LoggerProvider>(TYPES.LoggerProvider).toProvider<Logger>(context => {
  return async name => {
    return context.container.getTagged<Logger>(TYPES.Logger, 'name', name)
  }
})

container.bind<LoggerDbPersister>(TYPES.LoggerDbPersister).to(LoggerDbPersister).inSingletonScope()
container.bind<LoggerFilePersister>(TYPES.LoggerFilePersister).to(LoggerFilePersister).inSingletonScope()
container.bind<BotpressAPIProvider>(TYPES.BotpressAPIProvider).to(BotpressAPIProvider).inSingletonScope()
container.bind<ModuleLoader>(TYPES.ModuleLoader).to(ModuleLoader).inSingletonScope()
container.bind<Botpress>(TYPES.Botpress).to(Botpress).inSingletonScope()
container.bind<HTTPServer>(TYPES.HTTPServer).to(HTTPServer).inSingletonScope()
container.bind<ConfigProvider>(TYPES.ConfigProvider).to(ConfigProvider).inSingletonScope()
container.bind<AnalyticsService>(TYPES.Statistics).to(AnalyticsService).inSingletonScope()
container.bind<DataRetentionJanitor>(TYPES.DataRetentionJanitor).to(DataRetentionJanitor).inSingletonScope()
container.bind<DataRetentionService>(TYPES.DataRetentionService).to(DataRetentionService).inSingletonScope()
container.bind<WorkspaceService>(TYPES.WorkspaceService).to(WorkspaceService).inSingletonScope()
container.bind<EventCollector>(TYPES.EventCollector).to(EventCollector).inSingletonScope()
container.bind<MigrationService>(TYPES.MigrationService).to(MigrationService).inSingletonScope()
container.bind<LocalActionServer>(TYPES.LocalActionServer).to(LocalActionServer).inSingletonScope()

// START PATCH: Dummy Services for PRO/NLU
container.bind<any>(TYPES.LicensingService).to(DummyLicensingService).inSingletonScope()
container.bind<any>(TYPES.AuthStrategies).to(DummyAuthStrategies).inSingletonScope()
container.bind<any>(NluServer).to(DummyNluProcess).inSingletonScope()

// PATCH: Disable NLU spawn by overriding default binding
const NLU_BIND_KEYS = ['NluServer', 'NluProcess', 'nlu-server', 'nlu']
for (const key of NLU_BIND_KEYS) {
  try {
    container.rebind<any>(key).to(DummyNluProcess).inSingletonScope()
    console.log(`🧩 Bound DummyNluProcess to key: ${key}`)
  } catch (err) {
    container.bind<any>(key).to(DummyNluProcess).inSingletonScope()
    console.log(`🧩 Added DummyNluProcess under new key: ${key}`)
  }
}
// END PATCH

const isPackaged = !!eval('process.pkg')
container.bind<boolean>(TYPES.IsPackaged).toConstantValue(isPackaged)

// Load inversify modules
container.load(...DatabaseContainerModules)
container.load(...RepositoriesContainerModules)
container.load(...ServicesContainerModules)
container.load(...TelemetryContainerModules)

if (process.IS_PRO_ENABLED) {
  // const ProContainerModule = require('pro/pro.inversify')
  // container.load(ProContainerModule)
}

applyDisposeOnExit(container)
applyInitializeFromConfig(container)

export { container }
