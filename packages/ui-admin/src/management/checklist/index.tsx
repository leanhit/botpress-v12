import { Callout, Intent, Tag } from '@blueprintjs/core'
import _ from 'lodash'
import React, { FC, useEffect, useState } from 'react'
import { connect, ConnectedProps } from 'react-redux'

import api from '~/app/api'
import PageContainer from '~/app/common/PageContainer'
import { AppState } from '~/app/rootReducer'
import { DiagReport } from './DiagReport'
import Item from './Item'
import { fetchServerConfig } from './reducer'
import style from './style.scss'

const NOT_SET = 'Chưa thiết lập'

const getDisplayValue = (val: any) => {
  if (val === undefined || val === null) {
    return NOT_SET
  } else if (val === false || val === true) {
    return val.toString()
  } else {
    return val.length ? val.toString() : NOT_SET
  }
}

const isSet = (value: any): boolean => value !== NOT_SET

const protocol = window.location.protocol.substr(0, window.location.protocol.length - 1)

type Props = ConnectedProps<typeof connector>

const Container = props => {
  return (
    <PageContainer
      title="Danh sách kiểm tra môi trường Production"
      superAdmin={true}
      helpText={
        <span>
          Đây là danh sách các thiết lập được khuyến nghị khi chạy Botpress trong môi trường sản xuất (production).
          <br /> Các biến môi trường được hiển thị bằng <Tag>màu xám</Tag> và các giá trị từ file cấu hình
          <Tag intent={Intent.PRIMARY}>màu xanh dương</Tag>.
          <br />
          <br />
          Sau khi máy chủ của bạn đã được cấu hình chính xác, nên tắt trang này bằng cách đặt biến môi trường
          BP_DISABLE_SERVER_CONFIG = "true".
        </span>
      }
    >
      {props.children}
    </PageContainer>
  )
}

export const Checklist: FC<Props> = props => {
  const [langSource, setLangSource] = useState<any>()
  const [hasAuditTrail, setAuditTrail] = useState(false)

  useEffect(() => {
    if (!props.serverConfigLoaded) {
      props.fetchServerConfig()
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadData()
  }, [])

  const loadData = async () => {
    const { data: sources } = await api.getSecured().get('/admin/management/languages/sources')
    setLangSource(sources.languageSources)

    await checkAuditTrail()
  }

  const checkAuditTrail = async () => {
    const { data: debug } = await api.getSecured().get('/admin/health/debug')
    const audit = Object.keys(debug)
      .filter(x => x.startsWith('bp:audit'))
      .map(x => debug[x])

    setAuditTrail(_.some(audit, Boolean))
  }

  if (!props.serverConfig) {
    return (
      <Container>
        <Callout intent={Intent.PRIMARY}>
          Cấu hình máy chủ hiện đang bị vô hiệu hóa. Để xem trang này, hãy đặt biến môi trường
          "BP_DISABLE_SERVER_CONFIG" = false.
        </Callout>
      </Container>
    )
  }

  const getEnv = (key: string): any => getDisplayValue(_.get(props.serverConfig!.env, key))
  const getConfig = (path: string): any => getDisplayValue(_.get(props.serverConfig!.config, path))
  const getLive = (path: string): any => getDisplayValue(_.get(props.serverConfig!.live, path))

  const languageEndpoint = _.get(langSource, '[0].endpoint', '')

  return (
    <Container>
      <div className={style.checklist}>
        <Item
          title="Sử dụng cơ sở dữ liệu Postgres"
          docs="https://botpress.com/docs/building-chatbots/developers/database#how-to-switch-from-sqlite-to-postgressql"
          status={getEnv('DATABASE_URL').startsWith('postgres') ? 'success' : 'warning'}
          source={[{ type: 'env', key: 'DATABASE_URL', value: '**********' }]}
        >
          Mặc định, Botpress sử dụng cơ sở dữ liệu SQLite, điều này không được khuyến nghị cho môi trường production.
          Postgres ổn định hơn và cho phép chạy Botpress ở chế độ cụm (cluster mode) để tăng hiệu suất.
        </Item>

        <Item
          title="Sử dụng BPFS lưu trữ trong cơ sở dữ liệu"
          docs="https://botpress.com/docs/enterprise/server-and-cicd-management/production-checklist#use-the-database-bpfs-storage"
          status={getEnv('BPFS_STORAGE') === 'database' ? 'success' : 'warning'}
          source={[{ type: 'env', key: 'BPFS_STORAGE', value: getEnv('BPFS_STORAGE') }]}
        >
          Khi tùy chọn này được bật, toàn bộ bot và tệp cấu hình được lưu trong cơ sở dữ liệu. Điều này cho phép nhiều
          máy chủ truy cập dữ liệu mới nhất cùng lúc.
        </Item>

        <Item
          title="Chạy Botpress ở chế độ sản xuất (Production Mode)"
          docs="https://botpress.com/docs/enterprise/server-and-cicd-management/production-checklist#run-botpress-in-production-mode"
          status={getEnv('BP_PRODUCTION') === 'true' ? 'success' : 'warning'}
          source={[{ type: 'env', key: 'BP_PRODUCTION', value: getEnv('BP_PRODUCTION') }]}
        >
          Khi chạy ở chế độ production:
          <ul>
            <li>Ẩn thông tin lỗi chi tiết (stack trace)</li>
            <li>Tắt log debug và log lỗi để tăng tốc độ</li>
            <li>Tối ưu các bước xác thực nội bộ</li>
            <li>Cho phép chạy nhiều máy chủ đồng thời (cluster mode)</li>
          </ul>
        </Item>

        <Item
          title="Cấu hình địa chỉ URL bên ngoài của máy chủ"
          docs="https://botpress.com/docs/enterprise/server-and-cicd-management/production-checklist#configure-the-external-server-url"
          status={isSet(getEnv('EXTERNAL_URL')) || isSet(getConfig('httpServer.externalUrl')) ? 'success' : 'warning'}
          source={[
            { type: 'env', key: 'EXTERNAL_URL', value: getEnv('EXTERNAL_URL') },
            { type: 'config', key: 'httpServer.externalUrl', value: getConfig('httpServer.externalUrl') }
          ]}
        >
          Nếu không cấu hình, Botpress sẽ mặc định sử dụng http://localhost:3000, có thể gây lỗi hiển thị hoặc liên kết
          hỏng. Trong Botpress Professional, giá trị này còn được dùng để xác minh giấy phép.
        </Item>

        <Item
          title="Bật hỗ trợ Redis"
          status={isSet(getEnv('REDIS_URL')) && isSet(getEnv('CLUSTER_ENABLED')) ? 'success' : 'warning'}
          source={[
            { type: 'env', key: 'REDIS_URL', value: '**********' },
            { type: 'env', key: 'CLUSTER_ENABLED', value: getEnv('CLUSTER_ENABLED') },
            { type: 'env', key: 'BP_REDIS_SCOPE', value: getEnv('BP_REDIS_SCOPE') }
          ]}
        >
          Redis cho phép bạn chạy nhiều máy chủ Botpress sử dụng cùng một nguồn dữ liệu. Nên đặt các biến 'REDIS_URL' và
          'CLUSTER_ENABLED' để Redis hoạt động đúng. Biến 'BP_REDIS_SCOPE' có thể dùng để tách các môi trường staging và
          production.
        </Item>

        <Item
          title="Giới hạn CORS cho tên miền của bạn"
          status={
            getConfig('httpServer.cors.enabled') === 'false' || isSet(getConfig('httpServer.cors.origin'))
              ? 'success'
              : 'warning'
          }
          source={[
            { type: 'config', key: 'httpServer.cors.enabled', value: getConfig('httpServer.cors.enabled') },
            { type: 'config', key: 'httpServer.cors.origin', value: getConfig('httpServer.cors.origin') }
          ]}
        >
          Mặc định, Botpress cho phép mọi nguồn (origin) truy cập. Bạn nên tắt CORS hoàn toàn hoặc chỉ định domain được
          phép truy cập.
        </Item>

        <Item
          title="Bật lưu trữ JWT Token bằng Cookie"
          docs="https://botpress.com/docs/enterprise/server-and-cicd-management/production-checklist#enable-cookie-storage-for-the-jwt-token"
          status={getConfig('jwtToken.useCookieStorage') === 'true' ? 'success' : 'warning'}
          source={[
            { type: 'config', key: 'jwtToken.useCookieStorage', value: getConfig('jwtToken.useCookieStorage') },
            { type: 'config', key: 'jwtToken.cookieOptions', value: getConfig('jwtToken.cookieOptions') },
            { type: 'config', key: 'httpServer.cors.credentials', value: getConfig('httpServer.cors.credentials') }
          ]}
        >
          Lưu token trong cookie giúp tăng bảo mật cho phiên đăng nhập. Cần cấu hình CORS trước khi bật tính năng này.
          Hãy tham khảo tài liệu hướng dẫn để biết thêm chi tiết.
        </Item>

        <Item
          title="Tự lưu trữ máy chủ ngôn ngữ của bạn"
          docs="https://botpress.com/docs/enterprise/server-and-cicd-management/production-checklist#host-your-own-language-server"
          status={languageEndpoint.includes('botpress.io') ? 'warning' : 'success'}
          source={[{ type: 'config', key: 'nlu.json: languageSources', value: languageEndpoint }]}
        >
          Máy chủ ngôn ngữ mặc định của Botpress là công cộng (public) và có giới hạn truy cập. Bạn nên tự thiết lập máy
          chủ riêng và cập nhật đường dẫn trong file cấu hình <strong>global/data/config/nlu.json</strong>.
        </Item>

        <Item
          title="Bảo mật máy chủ bằng HTTPS"
          docs="https://botpress.com/docs/enterprise/server-and-cicd-management/production-checklist#securing-your-server-with-https"
          status={protocol === 'https' ? 'success' : 'warning'}
          source={[{ key: 'Giao thức phát hiện', value: protocol }]}
        >
          Botpress không xử lý chứng chỉ HTTPS trực tiếp. Hãy dùng NGINX đặt trước Botpress để xử lý chứng chỉ và bảo
          mật kết nối. Tham khảo cấu hình mẫu trong tài liệu.
        </Item>

        <Item
          title="Bật ghi vết hoạt động (Audit Trail)"
          docs="https://botpress.com/docs/enterprise/server-and-cicd-management/production-checklist#enable-audit-trail"
          status={hasAuditTrail ? 'success' : 'warning'}
        >
          Tính năng này ghi lại mọi yêu cầu gửi đến máy chủ (kèm người dùng/IP) và lưu trong log. Bạn có thể bật bằng
          cách chọn mục "Debug" trong menu bên trái.
        </Item>

        <Item
          title="Bật Sticky Sessions"
          docs="https://botpress.com/docs/enterprise/server-and-cicd-management/production-checklist#enable-sticky-sessions"
          status="none"
          source={[
            { type: 'config', key: 'httpServer.socketTransports', value: getConfig('httpServer.socketTransports') }
          ]}
        >
          Nếu bạn sử dụng "Polling" làm phương thức socket chính hoặc phụ, cần bật Sticky Sessions để handshake hoàn
          tất. Nếu chỉ sử dụng "Websocket", bạn có thể bỏ qua tùy chọn này.
          <br />
          <br />
          Tham khảo thêm tại:{' '}
          <a href="https://socket.io/docs/v4/using-multiple-nodes/#why-is-sticky-session-required" target="_blank">
            https://socket.io/docs/v4/using-multiple-nodes/#why-is-sticky-session-required
          </a>
          <br />
          <br />
          Cấu hình socket hiện tại của bạn:
        </Item>

        <Item
          title="Ghi log ra hệ thống tệp (Filesystem)"
          docs="https://botpress.com/docs/enterprise/server-and-cicd-management/production-checklist#output-logs-to-the-filesystem"
          status={getConfig('logs.fileOutput.enabled') === 'true' ? 'success' : 'none'}
          source={[{ type: 'config', key: 'logs.fileOutput.enabled', value: getConfig('logs.fileOutput.enabled') }]}
        >
          Mặc định, Botpress chỉ ghi log cơ bản vào cơ sở dữ liệu. Nên bật ghi log ra hệ thống tệp để lưu lại lịch sử
          hoạt động chi tiết.
        </Item>

        <Item
          title="Thay đổi đường dẫn gốc (Base Path) của Botpress"
          docs="https://botpress.com/docs/enterprise/server-and-cicd-management/production-checklist#change-botpress-base-path"
          status={isSet(getLive('ROOT_PATH')) ? 'success' : 'none'}
          source={[{ key: 'Đường dẫn gốc hiện tại', value: !isSet(getLive('ROOT_PATH')) ? '/' : getLive('ROOT_PATH') }]}
        >
          Mặc định, mọi yêu cầu được xử lý tại gốc URL. Bạn có thể thay đổi, ví dụ: http://localhost:3000/botpress. Chỉ
          cần cập nhật EXTERNAL_URL và thêm hậu tố đường dẫn tương ứng.
        </Item>

        <Item
          title="Tạo vai trò tùy chỉnh và xem lại quyền hạn"
          docs="https://botpress.com/docs/enterprise/server-and-cicd-management/production-checklist#create-custom-roles-and-review-permissions"
          status="none"
        >
          Khi tạo workspace, Botpress có sẵn một số vai trò mặc định. Nên xem lại và điều chỉnh quyền cho phù hợp.
        </Item>

        <Item
          title="Bật các cơ chế xác thực khác"
          docs="https://botpress.com/docs/enterprise/server-and-cicd-management/production-checklist#enable-other-authentication-mechanism"
          status="none"
        >
          Mặc định Botpress sử dụng xác thực tên đăng nhập/mật khẩu, nhưng bạn có thể bật thêm các cơ chế khác như LDAP,
          SAML hoặc OAUTH2.
        </Item>

        <Item
          title="Cấu hình Reverse Proxy và Load Balancing"
          docs="https://botpress.com/docs/enterprise/server-and-cicd-management/production-checklist#configure-your-reverse-proxy-and-load-balancing"
          status="none"
        >
          Xem thêm hướng dẫn chi tiết trong tài liệu chính thức của Botpress.
        </Item>

        <Item title="Tạo báo cáo chẩn đoán hệ thống" status="none">
          Công cụ này giúp tạo báo cáo hỗ trợ phân tích lỗi. Nó sẽ kiểm tra kết nối, quyền ghi thư mục, và tổng hợp các
          tệp cấu hình.
          <br />
          <br />
          Mật khẩu và thông tin nhạy cảm sẽ được ẩn (obfuscate).
          <br />
          <br />
          <DiagReport />
        </Item>
      </div>
    </Container>
  )
}

const mapStateToProps = (state: AppState) => ({
  serverConfig: state.checklist.serverConfig,
  serverConfigLoaded: state.checklist.serverConfigLoaded
})

const connector = connect(mapStateToProps, { fetchServerConfig })

export default connector(Checklist)
