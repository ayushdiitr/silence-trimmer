/**
 * Railway API Client
 * 
 * Provides programmatic access to Railway's API for custom domain management.
 * 
 * @see https://station.railway.com/feedback/enabling-complete-custom-domain-registra-6470c78b
 * @see https://docs.railway.app/reference/public-api
 */


const RAILWAY_API_URL = "https://backboard.railway.app/graphql/v2";

interface RailwayCustomDomainCreateResponse {
  data: {
    customDomainCreate: {
      id: string;
      domain: string;
      status: {
        dnsRecords: Array<{
          currentValue: string;
          fqdn: string;
          hostlabel: string;
          purpose: string;
          recordType: string;
          requiredValue: string;
          status: string;
          zone: string;
        }>;
        cdnProvider: string;
        certificateStatus: string;
      };
    };
  };
  errors?: Array<{
    message: string;
  }>;
}

interface RailwayCustomDomainDeleteResponse {
  data: {
    customDomainDelete: boolean;
  };
  errors?: Array<{
    message: string;
  }>;
}

/**
 * Create a custom domain in Railway and get the CNAME value
 * 
 * @param domain - The domain to add (e.g., "videos.acmecorp.com")
 * @returns The CNAME value to use in DNS configuration
 */
export async function createRailwayCustomDomain(domain: string): Promise<{
  success: boolean;
  cnameValue: string | null;
  domainId: string | null;
  error?: string;
}> {
  const railwayToken = process.env.RAILWAY_API_TOKEN;
  const railwayServiceId = process.env.RAILWAY_SERVICE_ID;

  if (!railwayToken) {
    console.warn("RAILWAY_API_TOKEN not configured - cannot auto-create custom domains");
    return {
      success: false,
      cnameValue: null,
      domainId: null,
      error: "Railway API token not configured",
    };
  }

  if (!railwayServiceId) {
    console.warn("RAILWAY_SERVICE_ID not configured - cannot auto-create custom domains");
    return {
      success: false,
      cnameValue: null,
      domainId: null,
      error: "Railway service ID not configured",
    };
  }

  const mutation = `
    mutation customDomainCreate($input: CustomDomainCreateInput!) {
      customDomainCreate(input: $input) {
        id
        domain
        status {
          dnsRecords {
            currentValue
            fqdn
            hostlabel
            purpose
            recordType
            requiredValue
            status
            zone
          }
          cdnProvider
          certificateStatus
        }
      }
    }
  `;

  const variables = {
    input: {
      domain: domain,
      environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
      projectId: process.env.RAILWAY_PROJECT_ID,
      serviceId: railwayServiceId,
    },
  };

  try {
    console.log('🔍 [DEBUG] Creating Railway custom domain...');
    console.log('🔍 [DEBUG] URL:', RAILWAY_API_URL);
    console.log('🔍 [DEBUG] Service ID:', railwayServiceId);
    console.log('🔍 [DEBUG] Domain:', domain);
    console.log('🔍 [DEBUG] Variables:', JSON.stringify(variables, null, 2));

    const response = await fetch(RAILWAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${railwayToken}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables,
      }),
    });

    console.log('🔍 [DEBUG] Response status:', response.status);
    console.log('🔍 [DEBUG] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Railway API error response:', errorText);
      throw new Error(`Railway API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json() as RailwayCustomDomainCreateResponse;
    console.log('🔍 [DEBUG] Full Railway API response:', JSON.stringify(result, null, 2));

    if (result.errors && result.errors.length > 0) {
      const errorMessage = result.errors.map(e => e.message).join(", ");
      console.error("Railway API error:", errorMessage);
      return {
        success: false,
        cnameValue: null,
        domainId: null,
        error: errorMessage,
      };
    }

    const customDomain = result.data.customDomainCreate;

    const cnameRecord = customDomain.status.dnsRecords.find(record => 
      record.requiredValue
    );

    if (!cnameRecord) {
      throw new Error("No CNAME record found in Railway response");
    }

    console.log(`✅ Custom domain created in Railway: ${domain} -> ${cnameRecord.requiredValue}`);

    return {
      success: true,
      cnameValue: cnameRecord.requiredValue,
      domainId: customDomain.id,
    };
  } catch (error) {
    console.error("Failed to create Railway custom domain:", error);
    return {
      success: false,
      cnameValue: null,
      domainId: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a custom domain from Railway
 * 
 * @param domainId - The Railway domain ID
 * @returns Success status
 */
export async function deleteRailwayCustomDomain(domainId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const railwayToken = process.env.RAILWAY_API_TOKEN;

  if (!railwayToken) {
    return {
      success: false,
      error: "Railway API token not configured",
    };
  }

  const mutation = `
    mutation customDomainDelete($id: String!) {
      customDomainDelete(id: $id)
    }
  `;

  const variables = {
    id: domainId,
  };

  try {
    const response = await fetch(RAILWAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${railwayToken}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`Railway API returned ${response.status}`);
    }

    const result = await response.json() as RailwayCustomDomainDeleteResponse;

    if (result.errors && result.errors.length > 0) {
      const errorMessage = result.errors.map(e => e.message).join(", ");
      return {
        success: false,
        error: errorMessage,
      };
    }

    console.log(`✅ Custom domain deleted from Railway: ${domainId}`);

    return {
      success: result.data.customDomainDelete,
    };
  } catch (error) {
    console.error("Failed to delete Railway custom domain:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
/**
 * Get the Railway service's custom domain CNAME target
 * This returns the CNAME value that users should point their DNS to
 */
export async function getRailwayCnameTarget(): Promise<string | null> {
  const railwayToken = process.env.RAILWAY_API_TOKEN;
  const railwayServiceId = process.env.RAILWAY_SERVICE_ID;
  const railwayEnvironmentId = process.env.RAILWAY_ENVIRONMENT_ID || '8d6e0de8-2af1-4190-b7c7-320912db0b26';
  const railwayProjectId = process.env.RAILWAY_PROJECT_ID || '20c41999-dfbc-4368-8fcd-74a1727c9520';

  if (!railwayToken || !railwayServiceId || !railwayEnvironmentId || !railwayProjectId) {
    console.warn("Railway API credentials not configured");
    console.warn("Required: RAILWAY_API_TOKEN, RAILWAY_SERVICE_ID, RAILWAY_ENVIRONMENT_ID, RAILWAY_PROJECT_ID");
    return null;
  }

  const query = `
    query GetDomains($environmentId: String!, $projectId: String!, $serviceId: String!) {
      domains(environmentId: $environmentId, projectId: $projectId, serviceId: $serviceId) {
        serviceDomains {
          domain
          suffix
        }
        customDomains {
          status {
            dnsRecords {
              requiredValue
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(RAILWAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${railwayToken}`,
      },
      body: JSON.stringify({
        query,
        variables: { 
          environmentId: railwayEnvironmentId,
          projectId: railwayProjectId,
          serviceId: railwayServiceId 
        },
      }),
    });

    if (!response.ok) {
      console.error('❌ Failed to fetch Railway service info:', response.status);
      return null;
    }

    const result = await response.json();

    // Check for GraphQL errors
    if (result.errors && result.errors.length > 0) {
      console.error('❌ GraphQL errors:', JSON.stringify(result.errors, null, 2));
      return null;
    }

    const domains = result.data?.domains;
    
    if (!domains) {
      return null;
    }

    // First try to get from customDomains (the requiredValue we need)
    const customDomains = domains.customDomains;
    
    if (customDomains && customDomains.length > 0) {
      const dnsRecords = customDomains[0].status?.dnsRecords;
      
      if (dnsRecords && dnsRecords.length > 0) {
        const requiredValue:string = dnsRecords[0].requiredValue;
        
        if (requiredValue) {
          return requiredValue;
        }
      }
    }

    // Fallback to serviceDomains if no customDomains
    const serviceDomains = domains.serviceDomains;
    
    if (serviceDomains && serviceDomains.length > 0) {
      const cnameTarget: string = serviceDomains[0].domain;
      
      if (cnameTarget) {
        return cnameTarget;
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error fetching Railway CNAME:', error);
    return null;
  }
}
/**
 * Check if Railway API is configured
 */
export function isRailwayApiConfigured(): boolean {
  const hasToken = !!process.env.RAILWAY_API_TOKEN;
  const hasServiceId = !!process.env.RAILWAY_SERVICE_ID;
  const hasEnvironmentId = !!process.env.RAILWAY_ENVIRONMENT_ID;
  const hasProjectId = !!process.env.RAILWAY_PROJECT_ID;
  
  console.log('🔍 [DEBUG] Railway API configuration check:', {
    hasToken,
    hasServiceId,
    hasEnvironmentId,
    hasProjectId,
    configured: hasToken && hasServiceId && hasEnvironmentId && hasProjectId
  });
  
  return !!(hasToken && hasServiceId && hasEnvironmentId && hasProjectId);
}

