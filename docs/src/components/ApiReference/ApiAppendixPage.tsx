import Layout from '@theme/Layout'
import type { ApiSurface } from '../../api-reference/presentation'
import ApiReference from './index'
import styles from './styles.module.css'

export default function ApiAppendixPage({
  data,
}: {
  data: { surface: ApiSurface; methodPath: string; title: string }
}) {
  return (
    <Layout title={data.title} description="Source-backed supporting API type definitions.">
      <main className={styles.appendixMain}>
        <div className="padding-top--md padding-bottom--lg container">
          <div className={`row ${styles.appendixRow}`}>
            <div className={`col ${styles.appendixColumn}`}>
              <article className={`markdown ${styles.appendixArticle}`}>
                <h1>{data.title}</h1>
                <p>
                  <a href={data.methodPath}>Back to the method reference</a>
                </p>
                <ApiReference data={data.surface} />
              </article>
            </div>
            <div className={`col col--3 ${styles.appendixRail}`} aria-hidden="true" />
          </div>
        </div>
      </main>
    </Layout>
  )
}
